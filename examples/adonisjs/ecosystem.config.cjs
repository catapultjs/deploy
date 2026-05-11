module.exports = {
  apps: [
    {
      name: 'myapp',
      cwd: './build',
      script: 'npm',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
    },
  ],
}
