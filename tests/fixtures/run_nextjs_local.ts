import { set, runTask } from '../../index.ts'
import { Context } from '../../src/context.ts'
import { getPipeline } from '../../src/pipeline.ts'
import '../../recipes/nextjs_local.ts'

const { store } = JSON.parse(process.argv[2])
for (const [key, value] of Object.entries(store)) set(key, value)
const host = {
  name: 'test',
  ssh: 'deploy@example.test',
  deployPath: '/srv/app',
  multiplexing: false,
}
const context = { release: 'test', hooks: {}, config: { hosts: [host], keepReleases: 5 } }
Context.set(context)
await runTask('deploy:build', context, host)
await runTask('deploy:update_code', context, host)
console.log(JSON.stringify(getPipeline()))
