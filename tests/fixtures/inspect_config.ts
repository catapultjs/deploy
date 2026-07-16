import { loadDeployConfig } from '../../src/config/loader.ts'
import { getPipeline } from '../../src/pipeline.ts'
import { getTaskDescription, getTasks } from '../../src/task.ts'
import { writeFile } from 'node:fs/promises'

const configPath = process.argv[2]
if (!configPath) throw new Error('Missing config path')
const reportPath = process.argv[3]
if (!reportPath) throw new Error('Missing report path')

const initialize = await loadDeployConfig(configPath)
await initialize()

await writeFile(
  reportPath,
  JSON.stringify({
    pipeline: getPipeline(),
    tasks: getTasks().map((name) => ({ name, description: getTaskDescription(name) })),
  })
)
