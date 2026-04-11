import { task, desc, cd, run, bin, after, pm, pmInstall, pmInstallProd } from '../index.ts'

desc('Installs dependencies with frozen lockfile')
task('bun:install', () => {
  cd('{{release_path}}')
  run(pmInstall())
})

desc('Installs production-only dependencies')
task('bun:install:production', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

desc('Builds the application')
task('bun:build', () => {
  cd('{{release_path}}')
  run(`${bin(pm())} run build`)
})

after('deploy:shared', 'bun:install')
after('bun:install', 'bun:build')
