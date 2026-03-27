import { BaseCommand, flags } from '@adonisjs/ace'
import { getCtx } from '../src/ctx.ts'
import { acquireLock, releaseLock, rollbackHost } from '../src/host.ts'

export default class Rollback extends BaseCommand {
  static commandName = 'rollback'
  static description = 'Rollback to the previous release'

  @flags.string({ description: 'Rollback a specific host' })
  declare host: string | undefined

  async run() {
    const ctx = getCtx()

    const hosts = this.host
      ? ctx.config.hosts.filter((h) => h.name === this.host)
      : ctx.config.hosts

    for (const host of hosts) {
      await acquireLock(ctx, host)
      try {
        await rollbackHost(ctx, host)
      } finally {
        await releaseLock(ctx, host)
      }
    }
    this.logger.action('rollback').succeeded()
  }
}
