import { BaseCommand, flags } from '@adonisjs/ace'
import { getCtx } from '../src/ctx.ts'
import { deployHost } from '../src/host.ts'

export default class Deploy extends BaseCommand {
  static commandName = 'deploy'
  static description = 'Deploy to servers'

  @flags.string({ description: 'Deploy to a specific host' })
  declare host: string | undefined

  async run() {
    const ctx = getCtx()

    const hosts = this.host
      ? ctx.config.hosts.filter((h) => h.name === this.host)
      : ctx.config.hosts

    if (this.host && hosts.length === 0) {
      this.logger.error(`Unknown host: ${this.host}`)
      this.exitCode = 1
      return
    }

    console.log(`🚀 deploy release ${ctx.release}`)

    if (ctx.hooks.beforeDeploy) await ctx.hooks.beforeDeploy({ hosts })
    for (const host of hosts) {
      await deployHost(ctx, host)
    }
    if (ctx.hooks.afterDeploy) await ctx.hooks.afterDeploy({ hosts })

    this.logger.action('rollout').succeeded()
  }
}
