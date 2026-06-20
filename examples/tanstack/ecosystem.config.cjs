const path = require('path')
const deployPath = '/home/deploy/deploy-tanstack'

module.exports = {
  apps: [
    {
      name: 'tanstack',
      cwd: path.join(deployPath, 'current'),
      script: '.output/server/index.mjs',
      instances: 1,
      exec_mode: 'cluster',
    },
  ],
}
