const path = require('path')
// const root = path.resolve('../../', 'current', 'build')
// local build
const root = path.resolve('../../', 'current')

module.exports = {
  apps: [
    {
      name: 'adonis',
      cwd: root,
      script: 'node',
      args: 'bin/server.js',
    },
  ],
}
