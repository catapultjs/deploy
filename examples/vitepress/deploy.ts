import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/vitepress'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-vitepress',
    },
  ],
})
