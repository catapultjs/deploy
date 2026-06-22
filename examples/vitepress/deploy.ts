import { defineConfig, set } from '@catapultjs/deploy'

set('caddy_local_config_path', './Caddyfile')
set('caddy_config_path', '/etc/caddy/Caddyfile')
set('caddy_reload_after_publish', true)

import '@catapultjs/deploy/recipes/vitepress'
import '@catapultjs/deploy/recipes/caddy'

export default defineConfig({
  keepReleases: 2,
  hosts: [
    {
      name: 'production',
      ssh: {
        host: 'localhost',
        user: 'deploy',
        port: 2222,
      },
      deployPath: '/home/deploy/deploy-vitepress',
    },
  ],
})
