import { BaseCommand, flags } from '@adonisjs/ace'
import { getCtx } from '../src/ctx.ts'
import { deployHost } from '../src/host.ts'

export default class Deploy extends BaseCommand {
  static commandName = 'deploy'
  static description = 'Deploy to servers'

  @flags.string({ description: 'Deploy to a specific host' })
  declare host: string | undefined

  @flags.string({ description: 'Override the branch to deploy' })
  declare branch: string | undefined

  async run() {
    const ctx = getCtx()

    let hosts = this.host
      ? ctx.config.hosts.filter((h) => h.name === this.host)
      : ctx.config.hosts

    if (this.host && hosts.length === 0) {
      this.logger.error(`Unknown host: ${this.host}`)
      this.exitCode = 1
      return
    }

    hosts = await Promise.all(
      hosts.map(async (host) => {
        if (this.branch) return { ...host, branch: this.branch }
        if (typeof host.branch === 'object' && host.branch.ask) {
          const branch = await this.prompt.ask(`Branch to deploy for ${host.name}`, {
            default: host.branch.name,
          })
          return { ...host, branch }
        }
        return host
      })
    )

    console.log(`🚀 deploy release ${ctx.release}`)

    if (ctx.hooks.beforeDeploy) await ctx.hooks.beforeDeploy({ hosts })
    for (const host of hosts) {
      await deployHost(ctx, host)
    }
    if (ctx.hooks.afterDeploy) await ctx.hooks.afterDeploy({ hosts })

    this.logger.action('rollout').succeeded()
  }
}
