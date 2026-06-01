import type {} from '../../src/types.ts'
import { type TaskContext, task, desc } from '../../index.ts'
import { Verbose } from '../../src/enums.ts'
import { q, ssh, sleep } from '../../src/utils.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:healthcheck': true
  }
}

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
