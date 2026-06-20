import { defineConfig, task, upload } from '@catapultjs/deploy'
// import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/rsync'
import '@catapultjs/deploy/recipes/tanstack'
import '@catapultjs/deploy/recipes/pm2'

// For local development
task('up', () => {
  upload('../../catapultjs-deploy-0.10.0.tgz', './')
})

export default defineConfig({
  keepReleases: 2,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-tanstack',
      branch: 'main',
    },
  ],
})
