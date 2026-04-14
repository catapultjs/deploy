import { task, hasTask, desc, cd, run, bin, after, pm, pmInstall, pmInstallProd } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'bun:install': true
    'bun:install:production': true
    'bun:build': true
  }
}

desc('Installs dependencies with frozen lockfile')
task('bun:install', () => {
  cd('{{builder_path}}')
  run(pmInstall())
})

desc('Installs production-only dependencies')
task('bun:install:production', () => {
  cd('{{builder_path}}')
  run(pmInstallProd())
})

desc('Builds the application')
task('bun:build', () => {
  cd('{{builder_path}}')
  run(`${bin(pm())} run build`)
})

after('deploy:update_code', 'bun:install')
after('deploy:build:shared', 'bun:build')

if (hasTask('deploy:build:copy')) {
  after('deploy:build:copy', 'bun:install:production')
}
