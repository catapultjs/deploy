import { BaseCommand, flags } from '@adonisjs/ace'
import { getPipeline } from '../src/pipeline.ts'

export default class ListPipeline extends BaseCommand {
  static commandName = 'pipeline'
  static description = 'Show the current deployment pipeline'

  @flags.boolean({ description: 'Output result as JSON' })
  declare json: boolean

  async run() {
    const pipeline = getPipeline()

    if (this.json) {
      this.logger.log(JSON.stringify({ pipeline }, null, 2))
      return
    }

    const table = this.ui.table()
    table.head(['#', 'Task'])
    pipeline.forEach((name, i) => table.row([String(i + 1), name]))
    table.render()
  }
}
