import { flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { rollbackHost, getReleaseNames, getCurrentRelease } from '../src/deployer.ts'
import { runTask } from '../src/task.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Rollback extends BaseDeployCommand {
  static commandName = 'rollback'
  static description = 'Rollback to the previous release'

  @flags.boolean({ alias: 'i', description: 'Interactively select the target release' })
  declare interactive: boolean | undefined

  async run() {
    const ctx = Context.get()

    const hosts = await this.selectHosts()
    if (!hosts) return

    for (const host of hosts) {
      let target: string | undefined

      if (this.interactive) {
        const [releases, current] = await Promise.all([
          getReleaseNames(ctx, host),
          getCurrentRelease(ctx, host),
        ])

        if (releases.length === 0) {
          this.logger.error(`[${host.name}] no releases available`)
          this.exitCode = 1
          return
        }

        const choices = releases.map((r) => ({
          name: r,
          message: r === current ? `${r} (current)` : r,
          disabled: r === current,
        }))

        target = await this.prompt.choice(`[${host.name}] Select release to rollback to`, choices)
      }

      await runTask('deploy:lock', ctx, host)
      try {
        await rollbackHost(ctx, host, target)
      } finally {
        await runTask('deploy:unlock', ctx, host)
      }
    }
    this.logger.action('rollback').succeeded()
  }
}
