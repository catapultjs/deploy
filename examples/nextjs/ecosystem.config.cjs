const path = require('path')
const deployPath = '/home/deploy/deploy-next'

module.exports = {
  apps: [
    {
      name: 'next',
      cwd: path.join(deployPath, 'current'),
      script: '.next/standalone/server.js',
      args: 'start',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
