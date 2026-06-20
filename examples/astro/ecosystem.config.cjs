const path = require('path')
const deployPath = '/home/deploy/deploy-astro'

module.exports = {
  apps: [
    {
      name: 'astro',
      cwd: path.join(deployPath, 'current'),
      script: './dist/server/entry.mjs',
      args: 'start',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 4321,
      },
    },
  ],
}
