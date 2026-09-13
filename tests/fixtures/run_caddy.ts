import { set, runTask } from '../../index.ts'
import type { TaskName } from '../../src/types.ts'
import '../../recipes/caddy.ts'

const { store, tasks } = JSON.parse(process.argv[2])
for (const [key, value] of Object.entries(store)) set(key, value)

const host = {
  name: 'test',
  ssh: 'deploy@example.test',
  deployPath: '/srv/app',
  multiplexing: false,
}
const context = {
  release: 'test',
  hooks: {},
  config: { hosts: [host], keepReleases: 5 },
}

for (const name of tasks as TaskName[]) await runTask(name, context, host)
