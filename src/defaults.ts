import { $ } from 'execa'
import { q, ssh, sleep } from './utils.ts'
import { type TaskContext, task, desc, run, isVerbose } from './task.ts'
import { get } from './store.ts'

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
// Built-in tasks
// ---------------------------------------------------------------------------

desc('Creates a deploy lock to prevent concurrent deployments')
task('deploy:lock', async ({ host, deployCtx, paths }: TaskContext) => {
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

desc('Transfers code to the release directory (overridden by git or rsync recipe)')
task('deploy:update_code', async () => {})

desc('Symlinks shared directories and files into the release')
task('deploy:shared', () => {
  const dirs: string[] = get('shared_dirs', [])
  const files: string[] = get('shared_files', [])

  for (const dir of dirs) {
    const d = dir.replace(/^\//, '')
    run(`rm -rf {{release_path}}/${d}`)
    run(`ln -sfn {{shared_path}}/${d} {{release_path}}/${d}`)
  }

  for (const file of files) {
    const f = file.replace(/^\//, '')
    run(`rm -f {{release_path}}/${f}`)
    run(`ln -sfn {{shared_path}}/${f} {{release_path}}/${f}`)
  }
})

desc('Switches current symlink to the new release')
task('deploy:publish', () => {
  run('ln -sfn {{release_path}} {{current_path}}')
})

desc('Appends branch, commit and user info to revisions.log')
task('deploy:log_revision', async ({ host, deployCtx, logger }: TaskContext) => {
  const branch = typeof host.branch === 'object' ? host.branch.name : (host.branch ?? 'unknown')
  let commit = 'unknown'
  let user = 'unknown'

  try {
    if (isVerbose()) logger.cmd('git rev-parse HEAD')
    commit = (await $`git rev-parse HEAD`).stdout.trim()
    if (isVerbose()) logger.cmd('git config user.name')
    user = (await $`git config user.name`).stdout.trim()
  } catch {}

  const line = `Branch ${branch} (at ${commit}) deployed as release ${deployCtx.release} by ${user}`
  const logFile = `${host.deployPath}/revisions.log`

  await ssh(host, `echo ${q(line)} >> ${q(logFile)}`)
})

desc('Checks that the application is responding after deployment')
task('deploy:healthcheck', async ({ host, logger }: TaskContext) => {
  const { url, retries, delayMs = 3_000 } = host.healthcheck ?? {}

  logger.step(host.name, `healthcheck ${url}`)

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
        logger.step(host.name, `healthcheck OK (${i}/${retries})`)
        return
      } catch {
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
task('deploy:cleanup', async ({ deployCtx, host, paths }: TaskContext) => {
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
