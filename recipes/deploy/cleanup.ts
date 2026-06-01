import type {} from '../../src/types.ts'
import { type TaskContext, task, desc } from '../../index.ts'
import { q, ssh } from '../../src/utils.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:cleanup': true
  }
}

desc('Removes old releases, keeping the last N defined by keepReleases')
task('deploy:cleanup', async ({ config, host, paths }: TaskContext) => {
  await ssh(
    host,
    `
    set -e
    [ -d ${q(paths.releases)} ] || exit 0
    cd ${q(paths.releases)}

    count=$(find . -mindepth 1 -maxdepth 1 -type d -printf '%P\n' | wc -l | tr -d ' ')
    if [ "$count" -le ${config.keepReleases} ]; then
      exit 0
    fi

    find . -mindepth 1 -maxdepth 1 -type d -printf '%P\n' | sort -r | tail -n +$(( ${config.keepReleases} + 1 )) | xargs -r rm -rf
  `
  )
})
