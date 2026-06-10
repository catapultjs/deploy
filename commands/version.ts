import { BaseCommand, flags } from '@adonisjs/ace'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

export default class Version extends BaseCommand {
  static commandName = 'version'
  static description = 'Show the current version'

  @flags.boolean({ description: 'Output result as JSON' })
  declare json: boolean

  async run() {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))

    if (this.json) {
      this.logger.log(JSON.stringify({ version: pkg.version }, null, 2))
      return
    }

    this.logger.log(pkg.version)
  }
}
