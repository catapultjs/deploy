import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import './recipes/next'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-next',
      branch: 'main',
    },
  ],
})
