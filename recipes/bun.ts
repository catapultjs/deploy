import { task, cd, run, bin, after, pm, pmInstall, pmInstallProd } from '../index.ts'

task('bun:install', () => {
  cd('{{release_path}}')
  run(pmInstall())
})

task('bun:install:production', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

task('bun:build', () => {
  cd('{{release_path}}')
  run(`${bin(pm())} run build`)
})

after('deploy:shared', 'bun:install')
after('bun:install', 'bun:build')
