import { defineConfig } from '@catapultjs/deploy'
import './recipes/next_standalone.ts'
import '@catapultjs/deploy/recipes/rsync'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-next',
    },
  ],
})
