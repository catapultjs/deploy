import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/astro'
// import '@catapultjs/deploy/recipes/rsync'

// set('source_path', './dist/.')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-astro',
    },
  ],
})
