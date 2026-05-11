import { defineConfig, remove } from '@catapultjs/deploy'
import { Verbose } from '@catapultjs/deploy/enums'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'

remove('ace:migration:run')

export default defineConfig({
  verbose: Verbose.TRACE,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-test',
      branch: 'master',
    },
  ],
})
