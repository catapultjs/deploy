import { defineConfig, set, remove } from '@catapultjs/deploy'
import { Verbose } from '@catapultjs/deploy/enums'
import '@catapultjs/deploy/recipes/adonisjs_local'
// import '@catapultjs/deploy/recipes/rsync'
import '@catapultjs/deploy/recipes/pm2'

set('source_path', './build')

remove('ace:migration:run')

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
