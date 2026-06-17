import { defineConfig, set, after } from '@catapultjs/deploy';
import '@catapultjs/deploy/recipes/git';
import '@catapultjs/deploy/recipes/pm2';

set('shared_files', ['.env']);

after('deploy:update_code', 'deploy:install');
after('deploy:install', 'deploy:build');

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/deploy-nest',
      branch: 'main',
    },
  ],
});
