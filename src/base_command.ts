import type { DeployContext, Host } from './types.ts'
import { BaseCommand, flags } from '@adonisjs/ace'
import { Context } from './context.ts'
import { isHostSetup } from './deployer.ts'

export abstract class BaseDeployCommand extends BaseCommand {
  @flags.string({ alias: 'H', description: 'Target a specific host' })
  declare host: string | undefined

  protected async selectHosts(options: { all?: boolean } = {}): Promise<Host[] | null> {
    const ctx = Context.get()

    if (this.host) {
      const hosts = ctx.config.hosts.filter((h) => h.name === this.host)
      if (hosts.length === 0) {
        this.logger.error(`Unknown host: ${this.host}`)
        this.exitCode = 1
        return null
      }
      return hosts
    }

    if (options.all) return ctx.config.hosts

    if (ctx.config.hosts.length > 1) {
      const selected = await this.prompt.multiple(
        'Select hosts',
        ctx.config.hosts.map((h) => ({ name: h.name, message: h.name }))
      )
      const hosts = ctx.config.hosts.filter((h) => selected.includes(h.name))
      if (hosts.length === 0) {
        this.logger.error('No host selected')
        this.exitCode = 1
        return null
      }
      return hosts
    }

    return ctx.config.hosts
  }

  protected setupCommand(host: Host): string {
    return `npx cata deploy:setup -H ${host.name}`
  }

  protected missingSetupMessage(host: Host): string {
    return `[${host.name}] Catapult is not initialized on this server. Run: ${this.setupCommand(host)}`
  }

  protected async ensureHostSetup(ctx: DeployContext, host: Host): Promise<boolean> {
    if (await isHostSetup(ctx, host)) return true

    this.logger.error(this.missingSetupMessage(host))
    this.exitCode = 1
    return false
  }
}
