import { q, ssh, blue, sleep } from './utils.ts'
import { task, run } from './task.ts'
import type { TaskContext } from './task.ts'
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

task('deploy:unlock', async ({ host, paths }: TaskContext) => {
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

task('deploy:healthcheck', async ({ deployCtx, host }: TaskContext) => {
  console.log(`==> ${blue(`[${host.name}]`)} healthcheck ${host.healthcheckUrl}`)

  if (deployCtx.config.healthcheckRetries) {
    for (let i = 1; i <= deployCtx.config.healthcheckRetries; i += 1) {
      try {
        await ssh(
          host,
          `
          set -e
          curl --fail --silent --show-error --max-time 5 ${q(host.healthcheckUrl)} >/dev/null
        `
        )
        console.log(
          `==> ${blue(`[${host.name}]`)} healthcheck OK (${i}/${deployCtx.config.healthcheckRetries})`
        )
        return
      } catch {
        console.log(
          `==> ${blue(`[${host.name}]`)} healthcheck failed (${i}/${deployCtx.config.healthcheckRetries})`
        )
        if (i < deployCtx.config.healthcheckRetries) {
          await sleep(deployCtx.config.healthcheckDelayMs || 3_000)
        }
      }
    }
  }

  throw new Error(`[${host.name}] healthcheck failed: ${host.healthcheckUrl}`)
})

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
