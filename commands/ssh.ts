import type { Host } from '../src/types.ts'
import { execa } from 'execa'
import { Context } from '../src/context.ts'
import { resolveSshArgs, sshControlArgs } from '../src/utils.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Ssh extends BaseDeployCommand {
  static commandName = 'ssh'
  static description = 'Open an interactive SSH session on a host'

  protected async selectHost(): Promise<Host | null> {
    const ctx = Context.get()

    if (this.host) {
      const found = ctx.config.hosts.find((h) => h.name === this.host)
      if (!found) {
        this.logger.error(`Unknown host: ${this.host}`)
        this.exitCode = 1
        return null
      }
      return found
    }

    if (ctx.config.hosts.length === 1) {
      return ctx.config.hosts[0]
    }

    const selected = await this.prompt.choice(
      'Select a host',
      ctx.config.hosts.map((h) => ({ name: h.name, message: h.name }))
    )

    const found = ctx.config.hosts.find((h) => h.name === selected)
    if (!found) {
      this.logger.error('No host selected')
      this.exitCode = 1
      return null
    }

    return found
  }

  async run() {
    const host = await this.selectHost()
    if (!host) return

    const args = [...sshControlArgs(host), ...resolveSshArgs(host)]

    await execa('ssh', args, { stdio: 'inherit' })
  }
}
