import { set, runTask } from '../../index.ts'
import type { TaskName } from '../../src/types.ts'
import '../../recipes/systemd.ts'
import { deployHost, rollbackHost } from '../../src/deployer.ts'
import { setPipeline } from '../../src/pipeline.ts'
import { task, run } from '../../index.ts'

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

for (const name of tasks as TaskName[]) {
  if (name === 'auto-rollback') {
    setPipeline(['deploy:publish', 'systemd:restart', 'deploy:healthcheck'])
    task('deploy:publish', () => {
      run('publish-marker')
    })
    let checks = 0
    task('deploy:healthcheck', () => {
      if (++checks === 1) throw new Error('unhealthy deployment')
      run('healthcheck-marker')
    })
    try {
      await deployHost(context, host)
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'unhealthy deployment') throw error
    }
  } else if (name === 'rollback' || name === 'rollback-without-systemd') {
    setPipeline(
      name === 'rollback' ? ['systemd:restart', 'deploy:healthcheck'] : ['deploy:healthcheck']
    )
    task('deploy:healthcheck', () => {
      run('healthcheck-marker')
    })
    await rollbackHost(context, host, 'previous')
  } else await runTask(name, context, host)
}
