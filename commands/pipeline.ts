import { BaseCommand } from '@adonisjs/ace'
import { getPipeline } from '../src/pipeline.ts'

export default class ListPipeline extends BaseCommand {
  static commandName = 'pipeline'
  static description = 'Show the current deployment pipeline'

  async run() {
    const pipeline = getPipeline()

    const table = this.ui.table()
    table.head(['#', 'Task'])
    pipeline.forEach((name, i) => table.row([String(i + 1), name]))
    table.render()
  }
}
