import { $ } from 'execa'
import { q, ssh, sleep } from './utils.ts'
import { type TaskContext, task, desc, cd, run, isVerbose } from './task.ts'
import { pm, pmInstall } from './package_manager.ts'
import { initPipeline as setPipeline } from './pipeline.ts'
import { Verbose } from './enums.ts'
import { linkSharedPaths } from './actions.ts'

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
    'deploy:install': true
    'deploy:build': true
    'deploy:test': true
  }
}

// ---------------------------------------------------------------------------
// Built-in tasks
// ---------------------------------------------------------------------------

desc('Creates a deploy lock to prevent concurrent deployments')
task('deploy:lock', async ({ host, release, paths }: TaskContext) => {
  try {
    await ssh(
      host,
      `
      set -e
      if [ -f ${q(paths.lock)} ]; then
        echo "Deploy lock already present: ${paths.lock}" >&2
        exit 1
      fi
      echo ${q(release)} > ${q(paths.lock)}
    `,
      { quiet: true }
    )
  } catch (error) {
    throw new Error((error as any).stderr?.trim() || (error as Error).message)
  }
})

desc('Removes the deploy lock')
task('deploy:unlock', async ({ host, paths }: TaskContext) => {
  await ssh(
    host,
    `
    set +e
    rm -f ${q(paths.lock)}
    true
  `,
    { quiet: true }
  )
})

desc('Creates the release directory on the server')
task('deploy:release', () => {
  run('mkdir -p {{release_path}}')
})

desc('Method for updating code')
task('deploy:update_code', () => {
  throw new Error('Please implement this task')
})

desc('Symlinks shared directories and files into the release')
task('deploy:shared', () => {
  linkSharedPaths('{{release_path}}')
})

desc('Switches current symlink to the new release')
task('deploy:publish', () => {
  run('ln -sfn {{release_path}} {{current_path}}')
})

desc('Appends branch, commit and user info to revisions.log')
task('deploy:log_revision', async ({ host, paths, release, logger }: TaskContext) => {
  let branch = typeof host.branch === 'object' ? host.branch.name : (host.branch ?? 'unknown')
  if (branch === 'unknown') {
    try {
      if (isVerbose(Verbose.TRACE)) logger.cmd('git rev-parse --abbrev-ref HEAD')
      const branchResult = await $`git rev-parse --abbrev-ref HEAD`
      branch = branchResult.stdout.trim()
    } catch {}
  }
  let commit = 'unknown'
  let user = 'unknown'

  try {
    if (isVerbose(Verbose.TRACE)) logger.cmd('git rev-parse HEAD')
    const commitResult = await $`git rev-parse HEAD`
    commit = commitResult.stdout.trim()
    if (isVerbose(Verbose.TRACE)) logger.cmd('git config user.name')
    const userResult = await $`git config user.name`
    user = userResult.stdout.trim()
  } catch {}

  const line = JSON.stringify({
    release,
    branch,
    commit,
    user,
    date: new Date().toISOString(),
  })
  const logFile = `${paths.cataConfig}/revisions.log`

  await ssh(host, `echo ${q(line)} >> ${q(logFile)}`)
})

desc('Checks that the application is responding after deployment')
task('deploy:healthcheck', async ({ host, config, logger }: TaskContext) => {
  const { url, retries, delayMs = 3_000 } = host.healthcheck ?? {}
  const verbose = config.verbose ?? 0

  if (verbose >= Verbose.NORMAL) logger.step(host.name, `healthcheck ${url}`)

  if (retries) {
    for (let i = 1; i <= retries; i += 1) {
      try {
        await ssh(
          host,
          `
          set -e
          curl --fail --silent --show-error --max-time 5 ${q(url)} >/dev/null
        `
        )
        if (verbose >= Verbose.NORMAL) logger.step(host.name, `healthcheck OK (${i}/${retries})`)
        return
      } catch {
        if (verbose >= Verbose.NORMAL)
          logger.step(host.name, `healthcheck failed (${i}/${retries})`)
        if (i < retries) {
          await sleep(delayMs)
        }
      }
    }
  }

  throw new Error(`[${host.name}] healthcheck failed: ${url}`)
})

desc('Removes old releases, keeping the last N defined by keepReleases')
task('deploy:cleanup', async ({ config, host, paths }: TaskContext) => {
  await ssh(
    host,
    `
    set -e
    [ -d ${q(paths.releases)} ] || exit 0
    cd ${q(paths.releases)}

    count=$(ls -1dt */ 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -le ${config.keepReleases} ]; then
      exit 0
    fi

    ls -1dt */ | tail -n +$(( ${config.keepReleases} + 1 )) | xargs -r rm -rf
  `
  )
})

desc('Installs dependencies in the release')
task('deploy:install', () => {
  cd('{{release_path}}')
  run(pmInstall())
})

desc('Builds the application in the release')
task('deploy:build', () => {
  cd('{{release_path}}')
  run(`${pm()} run build`)
})

desc('Tests the application in the release')
task('deploy:test', () => {
  cd('{{release_path}}')
  run(`${pm()} run test`)
})

setPipeline([
  'deploy:lock',
  'deploy:release',
  'deploy:update_code',
  'deploy:shared',
  'deploy:publish',
  'deploy:log_revision',
  'deploy:healthcheck',
  'deploy:unlock',
  'deploy:cleanup',
])
