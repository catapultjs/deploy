const path = require('path')
const deployPath = '/home/deploy/deploy-nuxt'

module.exports = {
  apps: [
    {
      name: 'nuxt',
      cwd: path.join(deployPath, 'current'),
      script: '.output/server/index.mjs',
      instances: 1,
      exec_mode: 'cluster',
    },
  ],
}
