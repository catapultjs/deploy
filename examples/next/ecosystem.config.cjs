const path = require('path')
const deployPath = '/home/deploy/deploy-next'

module.exports = {
  apps: [
    {
      name: 'next',
      cwd: path.join(deployPath, 'current'),
      script: './node_modules/.bin/next',
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
