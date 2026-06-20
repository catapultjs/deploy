import { defineConfig, set, remove } from '@catapultjs/deploy'
import { Verbose } from '@catapultjs/deploy/enums'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/rsync'
import '@catapultjs/deploy/recipes/pm2'

remove('ace:migration:run')

set('rsync_excludes', [
  '.git',
  'node_modules',
  '.env',
  '.DS_Store',
  '.idea',
  '.vscode',
  '.cursor',
  '.claude',
  'coverage',
  'tmp',
  'logs',
  'storage',
  'build',
  'deploy.ts',
  'deploy.locale.ts',
  'deploy.rsync.ts',
])

// For local development
// task('up', () => {
//   upload('../../catapultjs-deploy-0.7.0.tgz', './')
// })

export default defineConfig({
  keepReleases: 2,
  verbose: Verbose.TRACE,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-test',
    },
  ],
})
