import type { Host, DeployContext, Hooks, HookContext } from './types.ts'

import { q, getPaths, ssh, sleep } from './utils.ts'
import { task, run, getContext, runTask, getPipeline, get, blue, gray } from './task.ts'

declare module './types.ts' {
  interface TaskRegistry {
    'deploy:lock': true
    'deploy:release': true
    'deploy:update_code': true
    'deploy:shared': true
    'deploy:publish': true
    'deploy:log_revision': true
    'deploy:healthcheck': true
    'deploy:unlock': true
    'deploy:cleanup': true
  }
}

// ---------------------------------------------------------------------------
// Hook runner
// ---------------------------------------------------------------------------

export async function runHook(
  ctx: DeployContext,
  name: keyof Hooks,
  context: HookContext = {}
): Promise<void> {
  if (!ctx.hooks[name]) return
  console.log(`==> hook: ${name}`)
  await ctx.hooks[name]!(context)
}

// ---------------------------------------------------------------------------
// Built-in tasks
// ---------------------------------------------------------------------------

task('deploy:lock', async () => {
  const { host, deployCtx, paths } = getContext()

  try {
    await ssh(
      host,
      `
      set -e
      if [ -f ${q(paths.lock)} ]; then
        echo "Deploy lock already present: ${paths.lock}" >&2
        exit 1
      fi
      echo ${q(deployCtx.release)} > ${q(paths.lock)}
    `,
      { quiet: true }
    )
  } catch (error) {
    throw new Error((error as any).stderr?.trim() || (error as Error).message)
  }
})

task('deploy:unlock', async () => {
  const { host, paths } = getContext()
  await ssh(
    host,
    `
    set +e
    rm -f ${q(paths.lock)}
    true
  `
  )
})

task('deploy:release', () => {
  run('mkdir -p {{release_path}}')
})

task('deploy:update_code', async () => {})

task('deploy:shared', () => {
  const dirs: string[] = get('shared_dirs', [])
  const files: string[] = get('shared_files', [])

  for (const dir of dirs) {
    run(`rm -rf {{release_path}}/${dir}`)
    run(`ln -sfn {{shared_path}}/${dir} {{release_path}}/${dir}`)
  }

  for (const file of files) {
    run(`rm -f {{release_path}}/${file}`)
    run(`ln -sfn {{shared_path}}/${file} {{release_path}}/${file}`)
  }
})

task('deploy:publish', () => {
  run('ln -sfn {{release_path}} {{current_path}}')
})

task('deploy:log_revision', async () => {})

task('deploy:healthcheck', async () => {
  const { deployCtx, host } = getContext()
  await healthcheckOrThrow(deployCtx, host)
})

task('deploy:cleanup', async () => {
  const { deployCtx, host } = getContext()
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(
    host,
    `
    set -e
    [ -d ${q(paths.releases)} ] || exit 0
    cd ${q(paths.releases)}

    count=$(ls -1dt */ 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -le ${deployCtx.config.keepReleases} ]; then
      exit 0
    fi

    ls -1dt */ | tail -n +$(( ${deployCtx.config.keepReleases} + 1 )) | xargs -r rm -rf
  `
  )
})

// ---------------------------------------------------------------------------
// Internal operations
// ---------------------------------------------------------------------------

export async function setupHost(ctx: DeployContext, host: Host): Promise<void> {
  const paths = getPaths(host.deployPath, ctx.release)

  console.log(`==> ${blue(`[${host.name}]`)} setup directories`)

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
    ${mkdirs}
    ${mkfiles}
  `
  )
}

async function healthcheckOrThrow(ctx: DeployContext, host: Host): Promise<void> {
  console.log(`==> ${blue(`[${host.name}]`)} healthcheck ${host.healthcheckUrl}`)

  if (ctx.config.healthcheckRetries) {
    for (let i = 1; i <= ctx.config.healthcheckRetries; i += 1) {
      try {
        await ssh(
          host,
          `
        set -e
        curl --fail --silent --show-error --max-time 5 ${q(host.healthcheckUrl)} >/dev/null
      `
        )
        console.log(
          `==> ${blue(`[${host.name}]`)} healthcheck OK (${i}/${ctx.config.healthcheckRetries})`
        )
        return
      } catch {
        console.log(
          `==> ${blue(`[${host.name}]`)} healthcheck failed (${i}/${ctx.config.healthcheckRetries})`
        )
        if (i < ctx.config.healthcheckRetries) {
          await sleep(ctx.config.healthcheckDelayMs || 3_000)
        }
      }
    }
  }

  throw new Error(`[${host.name}] healthcheck failed: ${host.healthcheckUrl}`)
}

export async function getCurrentRelease(ctx: DeployContext, host: Host): Promise<string | null> {
  const paths = getPaths(host.deployPath, ctx.release)

  try {
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
  } catch {
    return null
  }
}

export async function getPreviousReleaseName(
  ctx: DeployContext,
  host: Host
): Promise<string | null> {
  const paths = getPaths(host.deployPath, ctx.release)
  const currentRelease = await getCurrentRelease(ctx, host)

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
    return null
  }

  const releases = stdout
    .split('\n')
    .map((line) => line.trim().replace(/\/$/, ''))
    .filter(Boolean)

  if (!currentRelease) {
    return releases[1] || releases[0] || null
  }

  return releases.find((name) => name !== currentRelease) ?? null
}

export async function rollbackHost(ctx: DeployContext, host: Host): Promise<void> {
  const paths = getPaths(host.deployPath, ctx.release)
  const previous = await getPreviousReleaseName(ctx, host)

  if (!previous) {
    throw new Error(`[${host.name}] no previous release available`)
  }

  console.log(`==> ${blue(`[${host.name}]`)} rollback to ${previous}`)

  await ssh(host, `set -e\nln -sfn ${q(paths.releases + '/' + previous)} ${q(paths.current)}`)

  if (getPipeline().includes('pm2:start')) {
    await runTask('pm2:start', ctx, host)
  }

  if (getPipeline().includes('deploy:healthcheck')) {
    await healthcheckOrThrow(ctx, host)
  }
}

function elapsed(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export async function deployHost(ctx: DeployContext, host: Host): Promise<void> {
  let published = false
  const deployStart = Date.now()

  await runHook(ctx, 'beforeHostDeploy', { host })

  try {
    for (const taskName of getPipeline()) {
      console.log(
        `${gray(elapsed(Date.now() - deployStart))} ${blue(`[${host.name}]`)} ${taskName}`
      )
      await runTask(taskName, ctx, host)
      if (taskName === 'deploy:publish') published = true
    }

    console.log(
      `✅ ${blue(`[${host.name}]`)} deploy OK -> ${ctx.release} ${gray(`(${elapsed(Date.now() - deployStart)})`)}`
    )
  } catch (error) {
    console.error(`❌ ${blue(`[${host.name}]`)} deploy failed: ${(error as Error).message}`)

    if (published) {
      try {
        await rollbackHost(ctx, host)
        console.log(`↩️ ${blue(`[${host.name}]`)} auto rollback OK`)
      } catch (rollbackError) {
        console.error(
          `💥 ${blue(`[${host.name}]`)} auto rollback failed: ${(rollbackError as Error).message}`
        )
      }
    }

    await runTask('deploy:unlock', ctx, host)
    throw error
  } finally {
    await runHook(ctx, 'afterHostDeploy', { host })
  }
}
