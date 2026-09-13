import { defineConfig, set, after } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/vitepress'
import '@catapultjs/deploy/recipes/caddy'

set('caddy_local_config_path', './Caddyfile')
set('caddy_config_path', '/etc/caddy/Caddyfile')
after('deploy:publish', 'caddy:reload')

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
