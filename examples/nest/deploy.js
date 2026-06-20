import { defineConfig, set, after } from '@catapultjs/deploy';
// import '@catapultjs/deploy/recipes/git';
import '@catapultjs/deploy/recipes/rsync';
import '@catapultjs/deploy/recipes/pm2';

set('shared_files', ['.env']);

after('deploy:update_code', 'deploy:install');
after('deploy:install', 'deploy:build');

export default defineConfig({
  keepReleases: 2,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-nest',
      branch: 'main',
    },
  ],
});
