import { flags } from '@adonisjs/ace'
import { MemoryRenderer } from '@poppinss/cliui'
import { Context } from '../src/context.ts'
import { collectHostStatus, HOST_STATUS_FIELDS, type HostStatus } from '../src/status.ts'
import { BaseDeployCommand } from '../src/base_command.ts'
import { CatapultLogger, logger } from '../src/logger.ts'

export default class Status extends BaseDeployCommand {
  static commandName = 'status'
  static description = 'Show server status'

  @flags.boolean({ description: 'Output result as JSON' })
  declare json: boolean

  async run() {
    const ctx = Context.get()

    const hosts = await this.selectHosts({ all: this.json })
    if (!hosts) return

    // In JSON mode, hooks that log directly would corrupt the JSON on stdout
    const hookLogger = this.json ? new CatapultLogger() : logger
    if (this.json) hookLogger.useRenderer(new MemoryRenderer())

    const report: HostStatus[] = []

    for (const host of hosts) {
      if (!(await this.ensureHostSetup(ctx, host))) continue

      if (!this.json) this.logger.log(this.colors.bold(`\n# ${host.name}`))

      const status = await collectHostStatus(ctx, host, hookLogger)
      report.push(status)

      if (status.error) this.logger.error(`status error: ${status.error}`)
      if (!this.json) this.printStatus(status)
    }

    if (this.json) {
      this.logger.log(JSON.stringify({ hosts: report }, null, 2))
    }
  }

  private printStatus(status: HostStatus) {
    if (status.release !== undefined) {
      this.logger.log(
        `Release  ${status.release ? this.colors.cyan(status.release) : this.colors.dim('none')}`
      )
    }

    if (status.health) {
      this.logger.log(
        `Health   ${status.health === 'ok' ? this.colors.green('OK') : this.colors.red('FAIL')}`
      )
    }

    if (status.packageManager) {
      this.logger.log(`Node     ${this.colors.dim(status.node || 'unavailable')}`)
      this.logger.log(
        `${status.packageManager.name.padEnd(8)} ${this.colors.dim(status.packageManager.version || 'unavailable')}`
      )
    }

    for (const [key, value] of Object.entries(status)) {
      if (HOST_STATUS_FIELDS.has(key)) continue
      this.logger.log(`${key.padEnd(8)} ${this.colors.dim(String(value))}`)
    }

    if (status.revision) {
      const { branch, commit, user, date } = status.revision as Record<string, string | undefined>
      this.logger.log(`Branch   ${this.colors.dim(branch ?? '—')}`)
      this.logger.log(`Commit   ${this.colors.dim(commit ? commit.slice(0, 7) : '—')}`)
      this.logger.log(`By       ${this.colors.dim(user ?? '—')}`)
      this.logger.log(`Date     ${this.colors.dim(date ? new Date(date).toLocaleString() : '—')}`)
    }

    if (status.lock !== undefined) {
      this.logger.log(
        `Lock     ${status.lock ? this.colors.yellow(status.lock) : this.colors.dim('none')}`
      )
    }
  }
}
