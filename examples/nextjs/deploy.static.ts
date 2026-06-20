import { defineConfig } from '@catapultjs/deploy'
// import '@catapultjs/deploy/recipes/rsync'
import '@catapultjs/deploy/recipes/nextjs_static'

export default defineConfig({
  keepReleases: 2,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-next',
    },
  ],
})
