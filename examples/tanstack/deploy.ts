import { defineConfig, after } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'

after('deploy:update_code', 'deploy:install')
after('deploy:install', 'deploy:build')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-tanstack',
      branch: 'main',
    },
  ],
})
