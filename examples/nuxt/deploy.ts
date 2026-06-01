import { defineConfig, set, task, upload, after } from '@catapultjs/deploy'
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

task('init', async () => {
  await upload('../../catapultjs-deploy-0.6.2.tgz', '/home/deploy/deploy-nuxt')
})

after('deploy:lock', 'init')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-nuxt',
    },
  ],
})
