import { flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { deployHost, initializeHost, isHostSetup } from '../src/deployer.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Deploy extends BaseDeployCommand {
  static commandName = 'deploy'
  static aliases = ['dep']
  static description = 'Deploy to servers'

  @flags.string({ alias: 'b', description: 'Override the branch to deploy' })
  declare branch: string | undefined

  @flags.boolean({ alias: 'v', description: 'Verbose output (-v, -vv, -vvv)' })
  declare verbose: boolean

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

    this.logger.log(`🚀 deploy release ${ctx.release}`)

    if (ctx.hooks.beforeDeploy) await ctx.hooks.beforeDeploy({ hosts })
    for (const host of hosts) {
      try {
        if (!(await isHostSetup(ctx, host))) {
          const shouldSetup = await this.prompt.choice(
            `[${host.name}] Catapult is not initialized on this server. Run deploy:setup now?`,
            [
              {
                name: 'yes',
                message: `Yes, run ${this.setupCommand(host)} and continue`,
              },
              {
                name: 'no',
                message: 'No, cancel deployment',
              },
            ]
          )

          if (shouldSetup === 'yes') {
            await initializeHost(ctx, host)
          } else {
            this.logger.error(this.missingSetupMessage(host))
            this.exitCode = 1
            return
          }
        }

        await deployHost(ctx, host)
      } catch (error) {
        if (ctx.hooks.afterFailure) await ctx.hooks.afterFailure({ hosts, error: error as Error })
        this.exitCode = 1
        return
      }
    }
    if (ctx.hooks.afterDeploy) await ctx.hooks.afterDeploy({ hosts })

    this.logger.action('success').succeeded()
  }
}
