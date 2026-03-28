import { BaseCommand } from '@adonisjs/ace'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

export default class Version extends BaseCommand {
  static commandName = 'version'
  static aliases = ['-v']
  static description = 'Show the current version'

  async run() {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
    this.logger.log(pkg.version)
  }
}
