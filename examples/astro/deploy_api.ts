import { Catapult } from '@catapultjs/deploy/api'
import '@catapultjs/deploy/recipes/astro'
// import '@catapultjs/deploy/recipes/pm2'

const catapult = new Catapult({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-astro',
    },
  ],
})

await catapult.setup()

try {
  await catapult.deploy()
} catch (error) {
  console.error(error.message)
}

// const { pipeline, extra } = await catapult.listTasks()
// console.log(pipeline, extra)

// const tasks = await catapult.pipeline()
// console.log(tasks)

// const hosts = await catapult.listRevisions({ limit: 4 })
// console.log(hosts[0])

// const releases = await catapult.listReleases()
// console.log(releases)

// const report = await catapult.status()
// console.log(report)

// await catapult.setup({ hosts: ['production'] })

// const [{ output }] = await catapult.task('pm2:list', { hosts: ['production'] })
// console.log(output)
