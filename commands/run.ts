import { args } from '@adonisjs/ace'
import { execa } from 'execa'
import { resolveSshArgs, sshControlArgs } from '../src/utils.ts'
import { BaseDeployCommand } from '../src/base_command.ts'

export default class Run extends BaseDeployCommand {
  static commandName = 'run'
  static description = 'Run a shell command on a host via SSH'

  @args.string({ description: 'Command to run on the remote host' })
  declare command: string

  async run() {
    const host = await this.selectHosts()
    if (!host) return

    for (const h of host) {
      const sshArgs = [...sshControlArgs(h), ...resolveSshArgs(h), this.command]
      await execa('ssh', sshArgs, { stdio: 'inherit' })
    }
  }
}
