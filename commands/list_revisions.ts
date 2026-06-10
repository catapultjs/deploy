import { flags } from '@adonisjs/ace'
import { Context } from '../src/context.ts'
import { q, getPaths, ssh } from '../src/utils.ts'
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

      const paths = getPaths(host.deployPath, ctx.release)
      const logFile = `${paths.cataConfig}/revisions.log`

      if (!this.json) this.logger.log(this.colors.bold(`\n# ${host.name}`))

      const { stdout } = await ssh(
        host,
        `set +e\n[ -f ${q(logFile)} ] && tail -10 ${q(logFile)} || true`
      )

      const lines = stdout.trim().split('\n').filter(Boolean).reverse()

      if (this.json) {
        const revisions: Record<string, unknown>[] = []
        for (const line of lines) {
          try {
            revisions.push(JSON.parse(line))
          } catch {}
        }
        report.push({ name: host.name, revisions })
        continue
      }

      const table = this.ui.table()
      table.head(['Release', 'Branch', 'Commit', 'By', 'Date'])

      if (lines.length === 0) {
        table.row(['no revisions', '', '', '', ''])
      } else {
        for (const line of lines) {
          try {
            const { release, branch, commit, user, date } = JSON.parse(line)
            table.row([
              release ?? '—',
              branch ?? '—',
              commit ? commit.slice(0, 7) : '—',
              user ?? '—',
              date ? new Date(date).toLocaleString() : '—',
            ])
          } catch {}
        }
      }

      table.render()
    }

    if (this.json) {
      this.logger.log(JSON.stringify({ hosts: report }, null, 2))
    }
  }
}
