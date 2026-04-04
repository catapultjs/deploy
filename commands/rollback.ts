import { Context } from '../src/context.ts'
import { rollbackHost } from '../src/host.ts'
import { runTask } from '../src/task.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Rollback extends BaseDeployCommand {
  static commandName = 'rollback'
  static description = 'Rollback to the previous release'

  async run() {
    const ctx = Context.get()

    const hosts = await this.selectHosts()
    if (!hosts) return

    for (const host of hosts) {
      await runTask('deploy:lock', ctx, host)
      try {
        await rollbackHost(ctx, host)
      } finally {
        await runTask('deploy:unlock', ctx, host)
      }
    }
    this.logger.action('rollback').succeeded()
  }
}
