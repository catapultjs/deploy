import type {} from '../../src/types.ts'
import { type TaskContext, task, desc } from '../../index.ts'
import { q, ssh } from '../../src/utils.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:lock': true
    'deploy:unlock': true
  }
}

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
