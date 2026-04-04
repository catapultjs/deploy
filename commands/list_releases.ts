import { Context } from '../src/context.ts'
import { getCurrentRelease } from '../src/host.ts'
import { q, getPaths, ssh } from '../src/utils.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class ListReleases extends BaseDeployCommand {
  static commandName = 'list:releases'
  static description = 'List releases on servers'

  async run() {
    const ctx = Context.get()

    const hosts = await this.selectHosts()
    if (!hosts) return

    for (const host of hosts) {
      const paths = getPaths(host.deployPath, ctx.release)

      const current = await getCurrentRelease(ctx, host)

      const { stdout } = await ssh(
        host,
        `
        set -e
        [ -d ${q(paths.releases)} ] || exit 0
        cd ${q(paths.releases)}
        ls -1dt */ 2>/dev/null || true
      `
      )

      const releases = stdout
        .split('\n')
        .map((line) => line.trim().replace(/\/$/, ''))
        .filter(Boolean)

      const table = this.ui.table()
      table.head(['', 'Release', 'Host'])

      if (releases.length === 0) {
        table.row(['', 'no releases', host.name])
      } else {
        for (const item of releases) {
          table.row([item === current ? '*' : '', item, host.name])
        }
      }

      table.render()
    }
  }
}
