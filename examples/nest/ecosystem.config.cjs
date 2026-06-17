const path = require('path');
const deployPath = '/home/deploy/deploy-nest';

module.exports = {
  apps: [
    {
      name: 'nest',
      cwd: path.join(deployPath, 'current'),
      script: 'node',
      args: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
