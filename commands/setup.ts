import { Context } from '../src/context.ts'
import { initializeHost } from '../src/deployer.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Setup extends BaseDeployCommand {
  static commandName = 'deploy:setup'
  static aliases = ['setup']
  static description = 'Initialize directories on servers'

  async run() {
    const ctx = Context.get()
    const hosts = await this.selectHosts()
    if (!hosts) return
    for (const host of hosts) {
      await initializeHost(ctx, host)
    }
    this.logger.action('setup').succeeded()
  }
}
