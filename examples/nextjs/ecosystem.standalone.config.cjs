const path = require('path')
const deployPath = '/home/deploy/deploy-next'

module.exports = {
  apps: [
    {
      name: 'next',
      cwd: path.join(deployPath, 'current'),
      script: 'server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
}
