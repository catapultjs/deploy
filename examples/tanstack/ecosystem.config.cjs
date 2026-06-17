const path = require('node:path')

const current = path.resolve(__dirname, '..', 'current')

module.exports = {
  apps: [
    {
      name: 'tanstack',
      script: path.join(current, '.output', 'server', 'index.mjs'),
      cwd: current,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
