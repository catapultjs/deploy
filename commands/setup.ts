import { Context } from '../src/context.ts'
import { setupHost } from '../src/deployer.ts'
import { hooks } from '../src/pipeline/hooks.ts'
import { BaseDeployCommand } from '../src/base_command.ts'
import { logger } from '../src/logger.ts'

export default class Setup extends BaseDeployCommand {
  static commandName = 'deploy:setup'
  static aliases = ['setup']
  static description = 'Initialize directories on servers'

  async run() {
    const ctx = Context.get()
    const hosts = await this.selectHosts()
    if (!hosts) return
    for (const host of hosts) {
      await setupHost(ctx, host)
      for (const hook of hooks.getSetup()) {
        await hook(ctx, host, logger)
      }
    }
    this.logger.action('setup').succeeded()
  }
}
