import { flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { deployHost } from '../src/host.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Deploy extends BaseDeployCommand {
  static commandName = 'deploy'
  static aliases = ['dep']
  static description = 'Deploy to servers'

  @flags.string({ description: 'Override the branch to deploy' })
  declare branch: string | undefined

  async run() {
    const ctx = Context.get()

    let hosts = await this.selectHosts()
    if (!hosts) return

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
      try {
        await deployHost(ctx, host)
      } catch (error) {
        this.logger.error((error as Error).message)
        this.exitCode = 1
        return
      }
    }
    if (ctx.hooks.afterDeploy) await ctx.hooks.afterDeploy({ hosts })

    this.logger.action('success').succeeded()
  }
}
