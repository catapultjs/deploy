import { defineConfig, task, local, set, before } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/nuxt_static'
import '@catapultjs/deploy/recipes/rsync'

export default defineConfig({
  keepReleases: 2,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-nuxt-static',
    },
  ],
})
