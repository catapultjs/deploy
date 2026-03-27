import { BaseCommand } from '@adonisjs/ace'
import { getCtx } from '../src/ctx.ts'
import { setupHost } from '../src/host.ts'
import { getSetupHooks } from '../src/task.ts'

export default class Setup extends BaseCommand {
  static commandName = 'deploy:setup'
  static description = 'Initialize directories on servers'

  async run() {
    const ctx = getCtx()
    for (const host of ctx.config.hosts) {
      await setupHost(ctx, host)
      for (const hook of getSetupHooks()) {
        await hook(ctx, host)
      }
    }
    this.logger.action('setup').succeeded()
  }
}
