import { BaseCommand, args, flags } from '@adonisjs/ace'
import { getCtx } from '../src/ctx.ts'
import { hasTask, runTask, getTasks } from '../src/task.ts'

export default class RunTask extends BaseCommand {
  static commandName = 'task'
  static description = 'Run a registered task on servers'

  @args.string({ description: 'Task name to run' })
  declare taskName: string

  @flags.string({ description: 'Run on a specific host' })
  declare host: string | undefined

  async run() {
    const ctx = getCtx()

    console.log(this.taskName)

    if (!hasTask(this.taskName)) {
      this.logger.error(`Unknown task: ${this.taskName}. Available: ${getTasks().join(', ')}`)
      this.exitCode = 1
      return
    }

    const hosts = this.host
      ? ctx.config.hosts.filter((h) => h.name === this.host)
      : ctx.config.hosts

    for (const host of hosts) {
      await runTask(this.taskName, ctx, host)
    }
  }
}
