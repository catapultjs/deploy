import { BaseCommand } from '@adonisjs/ace'
import { getCtx } from '../src/ctx.ts'
import { getCurrentRelease } from '../src/host.ts'
import { getPipeline, getStatusHooks } from '../src/task.ts'
import { q, getPaths, ssh } from '../src/utils.ts'

export default class Status extends BaseCommand {
  static commandName = 'status'
  static description = 'Show server status'

  async run() {
    const ctx = getCtx()

    for (const host of ctx.config.hosts) {
      const paths = getPaths(host.deployPath, ctx.release)

      this.logger.log(this.colors.bold(`\n# ${host.name}`))

      try {
        const current = await getCurrentRelease(ctx, host)
        this.logger.log(`Release  ${current ? this.colors.cyan(current) : this.colors.dim('none')}`)

        if (getPipeline().includes('deploy:healthcheck')) {
          try {
            await ssh(
              host,
              `set -e\ncurl --fail --silent --show-error --max-time 5 ${q(host.healthcheckUrl)} >/dev/null`
            )
            this.logger.log(`Health   ${this.colors.green('OK')}`)
          } catch {
            this.logger.log(`Health   ${this.colors.red('FAIL')}`)
          }
        }

        const { stdout: versionsStdout } = await ssh(
          host,
          `set +e\ncd ${q(paths.current)}\nnode --version 2>/dev/null || true\nnpm --version 2>/dev/null || true`
        )
        const [nodeVersion, npmVersion] = versionsStdout.trim().split('\n')
        this.logger.log(`Node     ${this.colors.dim(nodeVersion?.trim() || 'unavailable')}`)
        this.logger.log(`npm      ${this.colors.dim(npmVersion?.trim() || 'unavailable')}`)

        for (const hook of getStatusHooks()) {
          await hook(ctx, host)
        }

        const { stdout: lockStdout } = await ssh(
          host,
          `set +e\n[ -f ${q(paths.lock)} ] && cat ${q(paths.lock)} || true`
        )
        const lock = lockStdout.trim()
        this.logger.log(`Lock     ${lock ? this.colors.yellow(lock) : this.colors.dim('none')}`)
      } catch (error) {
        this.logger.error(`status error: ${(error as Error).message}`)
      }
    }
  }
}
