import { args, flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { hasTask, runTask, getTasks } from '../src/task.ts'
import { getCurrentRelease } from '../src/deployer.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class RunTask extends BaseDeployCommand {
  static commandName = 'task'
  static description = 'Run a registered task on servers'

  @args.string({ description: 'Task name to run' })
  declare taskName: string

  @flags.boolean({ alias: 'v', description: 'Verbose output (-v, -vv, -vvv)' })
  declare verbose: boolean

  async run() {
    const ctx = Context.get()

    if (!hasTask(this.taskName)) {
      this.logger.error(`Unknown task: ${this.taskName}. Available: ${getTasks().join(', ')}`)
      this.exitCode = 1
      return
    }

    const hosts = await this.selectHosts()
    if (!hosts) return

    for (const host of hosts) {
      const currentRelease = await getCurrentRelease(ctx, host)
      if (!currentRelease) {
        this.logger.error(`[${host.name}] no current release found, run deploy first`)
        this.exitCode = 1
        continue
      }
      await runTask(this.taskName, { ...ctx, release: currentRelease }, host)
    }
  }
}
