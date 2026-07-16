import { BaseCommand, flags } from '@adonisjs/ace'
import { loadDeployConfig } from '../src/config/loader.ts'
import { resolveDeployConfigFile } from '../src/config/resolve.ts'

export default class ConfigValidate extends BaseCommand {
  static commandName = 'config:validate'
  static description = 'Validate the deploy configuration file'

  @flags.boolean({ description: 'Output result as JSON' })
  declare json: boolean

  async run() {
    let file: string | null = null

    try {
      file = await resolveDeployConfigFile(process.argv.slice(2))
      const initialize = await loadDeployConfig(file)
      await initialize()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (this.json || process.argv.includes('--json')) {
        console.log(JSON.stringify({ valid: false, file, error: message }, null, 2))
      } else {
        this.logger.error(message)
      }
      this.exitCode = 1
      return
    }

    if (this.json || process.argv.includes('--json')) {
      console.log(JSON.stringify({ valid: true, file }, null, 2))
      return
    }

    this.logger.info(`Deploy config is valid: ${file}`)
  }
}
