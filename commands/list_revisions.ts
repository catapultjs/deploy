import { flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { getRevisions } from '../src/deployer.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class ListRevisions extends BaseDeployCommand {
  static commandName = 'list:revisions'
  static description = 'List the last 10 revisions on servers'

  @flags.boolean({ description: 'Output result as JSON' })
  declare json: boolean

  async run() {
    const ctx = Context.get()

    const hosts = await this.selectHosts({ all: this.json })
    if (!hosts) return

    const report: { name: string; revisions: Record<string, unknown>[] }[] = []

    for (const host of hosts) {
      if (!(await this.ensureHostSetup(ctx, host))) continue

      if (!this.json) this.logger.log(this.colors.bold(`\n# ${host.name}`))

      const revisions = await getRevisions(ctx, host)

      if (this.json) {
        report.push({ name: host.name, revisions })
        continue
      }

      const table = this.ui.table()
      table.head(['Release', 'Branch', 'Commit', 'By', 'Date'])

      if (revisions.length === 0) {
        table.row(['no revisions', '', '', '', ''])
      } else {
        for (const revision of revisions) {
          const { release, branch, commit, user, date } = revision as Record<
            string,
            string | undefined
          >
          table.row([
            release ?? '—',
            branch ?? '—',
            commit ? commit.slice(0, 7) : '—',
            user ?? '—',
            date ? new Date(date).toLocaleString() : '—',
          ])
        }
      }

      table.render()
    }

    if (this.json) {
      this.logger.log(JSON.stringify({ hosts: report }, null, 2))
    }
  }
}
