import { BaseCommand } from '@adonisjs/ace'
import { getTasks, getTaskDescription } from '../src/task.ts'
import { getPipeline } from '../src/pipeline.ts'

export default class ListTasks extends BaseCommand {
  static commandName = 'list:tasks'
  static description = 'List registered tasks and the current pipeline'

  async run() {
    const pipeline = getPipeline()
    const extra = getTasks().filter((t) => !pipeline.includes(t))

    this.logger.log('Pipeline')
    const pipelineTable = this.ui.table()
    pipelineTable.head(['Task', 'Description'])
    pipeline.forEach((name) => pipelineTable.row([name, getTaskDescription(name)]))
    pipelineTable.render()

    if (extra.length > 0) {
      this.logger.log('Extra tasks')
      const extraTable = this.ui.table()
      extraTable.head(['Task', 'Description'])
      extra.forEach((name) => extraTable.row([name, getTaskDescription(name)]))
      extraTable.render()
    }
  }
}
