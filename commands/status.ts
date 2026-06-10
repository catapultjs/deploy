import { flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { getCurrentRelease } from '../src/deployer.ts'
import { bin } from '../src/task.ts'
import { getPipeline } from '../src/pipeline.ts'
import { hooks } from '../src/pipeline/hooks.ts'
import { q, getPaths, ssh, detectPackageManager } from '../src/utils.ts'
import { BaseDeployCommand } from '../src/base_command.ts'
import { logger } from '../src/logger.ts'

interface HostStatus {
  name: string
  release?: string | null
  health?: 'ok' | 'fail'
  node?: string | null
  packageManager?: { name: string; version: string | null }
  revision?: Record<string, unknown>
  lock?: string | null
  error?: string
}

export default class Status extends BaseDeployCommand {
  static commandName = 'status'
  static description = 'Show server status'

  @flags.boolean({ description: 'Output result as JSON' })
  declare json: boolean

  async run() {
    const ctx = Context.get()

    const hosts = await this.selectHosts({ all: this.json })
    if (!hosts) return

    const pm = await detectPackageManager()
    const report: HostStatus[] = []

    for (const host of hosts) {
      if (!(await this.ensureHostSetup(ctx, host))) continue

      const paths = getPaths(host.deployPath, ctx.release)
      const status: HostStatus = { name: host.name }
      report.push(status)

      if (!this.json) this.logger.log(this.colors.bold(`\n# ${host.name}`))

      try {
        const current = await getCurrentRelease(ctx, host)
        status.release = current ?? null
        if (!this.json) {
          this.logger.log(
            `Release  ${current ? this.colors.cyan(current) : this.colors.dim('none')}`
          )
        }

        if (getPipeline().includes('deploy:healthcheck')) {
          try {
            await ssh(
              host,
              `set -e\n${bin('curl')} --fail --silent --show-error --max-time 5 ${q(host.healthcheck?.url)} >/dev/null`
            )
            status.health = 'ok'
            if (!this.json) this.logger.log(`Health   ${this.colors.green('OK')}`)
          } catch {
            status.health = 'fail'
            if (!this.json) this.logger.log(`Health   ${this.colors.red('FAIL')}`)
          }
        }

        const { stdout: versionsStdout } = await ssh(
          host,
          `set +e\ncd ${q(paths.current)}\necho "NODE:$(${bin('node')} --version 2>/dev/null || true)"\necho "PM:$(${bin(pm)} --version 2>/dev/null || true)"`
        )
        const lines = versionsStdout.trim().split('\n')
        const nodeVersion = lines.find((l) => l.startsWith('NODE:'))?.slice(5) || ''
        const pmVersion = lines.find((l) => l.startsWith('PM:'))?.slice(3) || ''
        status.node = nodeVersion || null
        status.packageManager = { name: pm, version: pmVersion || null }
        if (!this.json) {
          this.logger.log(`Node     ${this.colors.dim(nodeVersion || 'unavailable')}`)
          this.logger.log(`${pm.padEnd(8)} ${this.colors.dim(pmVersion || 'unavailable')}`)

          for (const hook of hooks.getStatus()) {
            await hook(ctx, host, logger)
          }
        }

        const { stdout: revStdout } = await ssh(
          host,
          `set +e\n[ -f ${q(paths.cataConfig + '/revisions.log')} ] && tail -1 ${q(paths.cataConfig + '/revisions.log')} || true`
        )
        const rev = revStdout.trim()
        if (rev) {
          try {
            const revision = JSON.parse(rev)
            const { branch, commit, user, date } = revision
            status.revision = revision
            if (!this.json) {
              this.logger.log(`Branch   ${this.colors.dim(branch ?? '—')}`)
              this.logger.log(`Commit   ${this.colors.dim(commit ? commit.slice(0, 7) : '—')}`)
              this.logger.log(`By       ${this.colors.dim(user ?? '—')}`)
              this.logger.log(
                `Date     ${this.colors.dim(date ? new Date(date).toLocaleString() : '—')}`
              )
            }
          } catch {}
        }

        const { stdout: lockStdout } = await ssh(
          host,
          `set +e\n[ -f ${q(paths.lock)} ] && cat ${q(paths.lock)} || true`
        )
        const lock = lockStdout.trim()
        status.lock = lock || null
        if (!this.json) {
          this.logger.log(`Lock     ${lock ? this.colors.yellow(lock) : this.colors.dim('none')}`)
        }
      } catch (error) {
        status.error = (error as Error).message
        this.logger.error(`status error: ${(error as Error).message}`)
      }
    }

    if (this.json) {
      this.logger.log(JSON.stringify({ hosts: report }, null, 2))
    }
  }
}
