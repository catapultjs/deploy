import { defineConfig, task, local, set, before } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/rsync'

set('source_path', './dist')

task('nuxt:generate', async () => {
  await local('nuxt generate')
})

before('deploy:lock', 'nuxt:generate')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-nuxt-static',
    },
  ],
})
