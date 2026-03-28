import type { Host, DeployContext, Hooks, HookContext } from './types.ts'

import { $ } from 'execa'
import { q, getPaths, ssh, sleep } from './utils.ts'
import { task, run, getContext, runTask, getPipeline } from './task.ts'

declare module './types.ts' {
  interface TaskRegistry {
    'deploy:release': true
    'deploy:upload': true
    'deploy:publish': true
    'deploy:log': true
    'deploy:healthcheck': true
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
// Built-in tasks (génériques)
// ---------------------------------------------------------------------------

task('deploy:release', () => {
  run('mkdir -p {{release_path}}')
})

task('deploy:upload', async () => {
  const { host, paths, deployCtx } = getContext()

  if (!host.branch) throw new Error(`[${host.name}] git mode requires "branch" on host`)

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch

  let repository = deployCtx.config.repository
  if (!repository) {
    repository = (await $`git remote get-url origin`).stdout.trim()
  }

  await ssh(
    host,
    `set -e\ngit clone --depth 1 --branch ${q(branchName)} ${q(repository)} ${q(paths.release)}`
  )
})

task('deploy:publish', () => {
  run('ln -sfn {{release_path}} {{current_path}}')
})

task('deploy:log', async () => {
  const { host, deployCtx } = getContext()

  let branch = 'unknown'
  let commit = 'unknown'
  let user = 'unknown'

  try {
    branch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
    commit = (await $`git rev-parse HEAD`).stdout.trim()
    user = (await $`git config user.name`).stdout.trim()
  } catch {}

  const line = `Branch ${branch} (at ${commit}) deployed as release ${deployCtx.release} by ${user}`
  const logFile = `${host.deployPath}/revisions.log`

  await ssh(host, `echo ${q(line)} >> ${q(logFile)}`)
})

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

  console.log(`==> [${host.name}] setup directories`)

  await ssh(
    host,
    `
    set -e
    mkdir -p ${q(paths.base)}
    mkdir -p ${q(paths.releases)}
    mkdir -p ${q(paths.shared)}
  `
  )
}

export async function acquireLock(ctx: DeployContext, host: Host): Promise<void> {
  const paths = getPaths(host.deployPath, ctx.release)

  console.log(`==> [${host.name}] acquire lock`)

  try {
    await ssh(
      host,
      `
      set -e
      if [ -f ${q(paths.lock)} ]; then
        echo "Deploy lock already present: ${paths.lock}" >&2
        exit 1
      fi
      echo ${q(ctx.release)} > ${q(paths.lock)}
    `,
      { quiet: true }
    )
  } catch (error) {
    throw new Error((error as any).stderr?.trim() || (error as Error).message)
  }
}

export async function releaseLock(ctx: DeployContext, host: Host): Promise<void> {
  const paths = getPaths(host.deployPath, ctx.release)

  console.log(`==> [${host.name}] release lock`)

  await ssh(
    host,
    `
    set +e
    rm -f ${q(paths.lock)}
    true
  `
  )
}

async function healthcheckOrThrow(ctx: DeployContext, host: Host): Promise<void> {
  console.log(`==> [${host.name}] healthcheck ${host.healthcheckUrl}`)

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
        console.log(`==> [${host.name}] healthcheck OK (${i}/${ctx.config.healthcheckRetries})`)
        return
      } catch {
        console.log(`==> [${host.name}] healthcheck failed (${i}/${ctx.config.healthcheckRetries})`)
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

  console.log(`==> [${host.name}] rollback to ${previous}`)

  await ssh(host, `set -e\nln -sfn ${q(paths.releases + '/' + previous)} ${q(paths.current)}`)

  if (getPipeline().includes('pm2:start')) {
    await runTask('pm2:start', ctx, host)
  }

  if (getPipeline().includes('deploy:healthcheck')) {
    await healthcheckOrThrow(ctx, host)
  }
}

export async function deployHost(ctx: DeployContext, host: Host): Promise<void> {
  let published = false

  await runHook(ctx, 'beforeHostDeploy', { host })
  await acquireLock(ctx, host)

  try {
    for (const taskName of getPipeline()) {
      console.log(`==> [${host.name}] ${taskName}`)
      await runTask(taskName, ctx, host)
      if (taskName === 'deploy:publish') published = true
    }

    console.log(`✅ [${host.name}] deploy OK -> ${ctx.release}`)
  } catch (error) {
    console.error(`❌ [${host.name}] deploy failed: ${(error as Error).message}`)

    if (published) {
      try {
        await rollbackHost(ctx, host)
        console.log(`↩️ [${host.name}] auto rollback OK`)
      } catch (rollbackError) {
        console.error(`💥 [${host.name}] auto rollback failed: ${(rollbackError as Error).message}`)
      }
    }

    throw error
  } finally {
    await releaseLock(ctx, host)
    await runHook(ctx, 'afterHostDeploy', { host })
  }
}
