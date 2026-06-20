import { defineConfig, set, task, upload, after } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/nuxt'
import '@catapultjs/deploy/recipes/rsync'
import '@catapultjs/deploy/recipes/pm2'

set('source_path', './')

set('rsync_excludes', [
  '.git',
  '.nuxt',
  '.output',
  'node_modules',
  '.env',
  '.DS_Store',
  'dist',
  'deploy.ts',
  'deploy.static.ts',
])

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
      deployPath: '/home/deploy/deploy-nuxt',
    },
  ],
})
