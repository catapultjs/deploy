import { Context } from '../src/context.ts'
import { setupHost } from '../src/host.ts'
import { getSetupHooks } from '../src/task.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Setup extends BaseDeployCommand {
  static commandName = 'deploy:setup'
  static description = 'Initialize directories on servers'

  async run() {
    const ctx = Context.get()
    const hosts = await this.selectHosts()
    if (!hosts) return
    for (const host of hosts) {
      await setupHost(ctx, host)
      for (const hook of getSetupHooks()) {
        await hook(ctx, host)
      }
    }
    this.logger.action('setup').succeeded()
  }
}
