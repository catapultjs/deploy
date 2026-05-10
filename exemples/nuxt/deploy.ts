import { defineConfig, task, local, set, before } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/nuxt'
import '@catapultjs/deploy/recipes/rsync'

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

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-nuxt',
    },
  ],
})
