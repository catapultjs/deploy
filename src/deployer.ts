import type { Host, DeployContext, Hooks, HookContext } from './types.ts'
import { Verbose } from './enums.ts'
import { q, getPaths, ssh, elapsed, isSshConnectionError } from './utils.ts'
import { runTask } from './task.ts'
import { get } from './store.ts'
import { getPipeline } from './pipeline.ts'
import { logger } from './logger.ts'
import { hooks } from './pipeline/hooks.ts'

// ---------------------------------------------------------------------------
// Hook runner
// ---------------------------------------------------------------------------

async function runHook(
  ctx: DeployContext,
  name: keyof Hooks,
  context: HookContext = {}
): Promise<void> {
  if (!ctx.hooks[name]) return
  if ((ctx.config.verbose ?? 0) >= Verbose.NORMAL) logger.step(`hook: ${name}`)
  await ctx.hooks[name]!(context)
}

// ---------------------------------------------------------------------------
// Host operations
// ---------------------------------------------------------------------------

export async function setupHost(ctx: DeployContext, host: Host): Promise<void> {
  const paths = getPaths(host.deployPath, ctx.release)

  if ((ctx.config.verbose ?? 0) >= Verbose.NORMAL) logger.step(host.name, 'setup directories')

  const dirs: string[] = get('writable_dirs', [])
  const files: string[] = get('shared_files', [])

  const mkdirs = dirs.map((dir) => `mkdir -p ${q(paths.shared + '/' + dir)}`).join('\n    ')
  const mkfiles = files
    .map(
      (file) =>
        `if [ ! -f ${q(paths.shared + '/' + file)} ]; then touch ${q(paths.shared + '/' + file)}; fi`
    )
    .join('\n    ')

  await ssh(
    host,
    `
    set -e
    mkdir -p ${q(paths.base)}
    mkdir -p ${q(paths.releases)}
    mkdir -p ${q(paths.shared)}
    mkdir -p ${q(paths.cataConfig)}
    ${mkdirs}
    ${mkfiles}
  `
  )
}

export async function initializeHost(ctx: DeployContext, host: Host): Promise<void> {
  await setupHost(ctx, host)
  for (const hook of hooks.getSetup()) {
    await hook(ctx, host, logger)
  }
}

export async function isHostSetup(ctx: DeployContext, host: Host): Promise<boolean> {
  const paths = getPaths(host.deployPath, ctx.release)

  try {
    await ssh(host, `set -e\n[ -d ${q(paths.cataConfig)} ]`)
    return true
  } catch (error) {
    // A non-zero exit from the remote test (dir absent) means the host is simply
    // not initialized. An SSH transport/auth failure means we couldn't check at
    // all — surface it instead of reporting a misleading "not initialized".
    if (isSshConnectionError(error)) throw error
    return false
  }
}

export async function getCurrentRelease(ctx: DeployContext, host: Host): Promise<string | null> {
  const paths = getPaths(host.deployPath, ctx.release)

  const { stdout } = await ssh(
    host,
    `
      set -e
      if [ -L ${q(paths.current)} ]; then
        basename "$(readlink ${q(paths.current)})"
      fi
    `
  )
  return stdout.trim() || null
}

export async function getReleaseNames(ctx: DeployContext, host: Host): Promise<string[]> {
  const paths = getPaths(host.deployPath, ctx.release)

  let stdout = ''
  try {
    ;({ stdout } = await ssh(
      host,
      `
      set -e
      cd ${q(paths.releases)}
      ls -1dt */ 2>/dev/null
    `
    ))
  } catch {
    return []
  }

  return stdout
    .split('\n')
    .map((line) => line.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export async function getRevisions(
  ctx: DeployContext,
  host: Host,
  limit = 10
): Promise<Record<string, unknown>[]> {
  const paths = getPaths(host.deployPath, ctx.release)
  const logFile = `${paths.cataConfig}/revisions.log`

  const { stdout } = await ssh(
    host,
    `set +e\n[ -f ${q(logFile)} ] && tail -${limit} ${q(logFile)} || true`
  )

  const revisions: Record<string, unknown>[] = []
  for (const line of stdout.trim().split('\n').filter(Boolean).reverse()) {
    try {
      revisions.push(JSON.parse(line))
    } catch {}
  }
  return revisions
}

async function getPreviousReleaseName(ctx: DeployContext, host: Host): Promise<string | null> {
  const paths = getPaths(host.deployPath, ctx.release)
  const { stdout } = await ssh(
    host,
    `set -e\nif [ -L ${q(paths.base + '/previous')} ]; then basename "$(readlink ${q(paths.base + '/previous')})"; fi`
  )
  return stdout.trim() || null
}

export async function rollbackHost(ctx: DeployContext, host: Host, target?: string): Promise<void> {
  const paths = getPaths(host.deployPath, ctx.release)
  const previous = target ?? (await getPreviousReleaseName(ctx, host))

  if (!previous) {
    throw new Error(`[${host.name}] no previous release available`)
  }

  if ((ctx.config.verbose ?? 0) >= Verbose.NORMAL) logger.step(host.name, `rollback to ${previous}`)

  if (!/^[a-zA-Z0-9_-]+$/.test(previous)) throw new Error('Invalid rollback release')
  const rollbackCtx = { ...ctx, release: previous }

  await ssh(
    host,
    `set -e
[ -d ${q(paths.releases + '/' + previous)} ]
if [ -L ${q(paths.current)} ] && [ "$(readlink -f ${q(paths.current)})" = "$(readlink -f ${q(paths.releases + '/' + previous)})" ]; then
  echo 'Rollback target is already current' >&2
  exit 1
fi
ln -sfn ${q(paths.releases + '/' + previous)} ${q(paths.current)}
rm -f ${q(paths.base + '/previous')}`
  )

  const pm2Task = ['pm2:startOrReload', 'pm2:start'].find((name) => getPipeline().includes(name))
  if (pm2Task) {
    await runTask(pm2Task, rollbackCtx, host)
    if (getPipeline().includes('pm2:save')) await runTask('pm2:save', rollbackCtx, host)
  }

  if (getPipeline().includes('systemd:restart')) {
    await runTask('systemd:restart', rollbackCtx, host)
  }

  if (getPipeline().includes('deploy:healthcheck')) {
    await runTask('deploy:healthcheck', rollbackCtx, host)
  }
}

export interface DeployObserver {
  taskStart?: (host: Host, task: string) => void
  taskDone?: (host: Host, task: string) => void
  taskError?: (host: Host, task: string, error: Error) => void
}

export async function deployHost(
  ctx: DeployContext,
  host: Host,
  observer?: DeployObserver
): Promise<void> {
  let locked = false
  let published = false
  let previousRelease: string | null = null
  let currentTask = ''
  const deployStart = Date.now()

  await runHook(ctx, 'beforeHostDeploy', { host })

  try {
    const verbose = ctx.config.verbose ?? 0
    for (const taskName of getPipeline()) {
      currentTask = taskName
      if (verbose >= Verbose.NORMAL)
        logger.task(elapsed(Date.now() - deployStart), host.name, taskName)
      observer?.taskStart?.(host, taskName)
      if (taskName === 'deploy:publish') previousRelease = await getCurrentRelease(ctx, host)
      await runTask(taskName, ctx, host)
      if (taskName === 'deploy:lock') locked = true
      if (taskName === 'deploy:publish') published = true
      if (taskName === 'deploy:unlock') {
        locked = false
        published = false
      }
      observer?.taskDone?.(host, taskName)
    }

    logger.ok(host.name, `deploy OK -> ${ctx.release}`, elapsed(Date.now() - deployStart))
  } catch (error) {
    observer?.taskError?.(host, currentTask, error as Error)
    logger.fail(host.name, `deploy failed: ${(error as Error).message}`)

    if (published) {
      try {
        if (!previousRelease) throw new Error('No previous release available')
        await rollbackHost(ctx, host, previousRelease)
        logger.rollback(host.name, 'auto rollback OK')
      } catch (rollbackError) {
        logger.boom(host.name, `auto rollback failed: ${(rollbackError as Error).message}`)
      }
    }

    if (locked) await runTask('deploy:unlock', ctx, host)
    throw error
  } finally {
    await runHook(ctx, 'afterHostDeploy', { host })
  }
}
