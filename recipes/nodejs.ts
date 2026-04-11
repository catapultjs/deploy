import type {} from '../src/types.ts'
import { task, desc, cd, run, bin, after, pm, pmInstall, pmInstallProd } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'nodejs:install': true
    'nodejs:install:production': true
    'nodejs:build': true
    'nodejs:test': true
  }
}

desc('Installs dependencies with frozen lockfile')
task('nodejs:install', () => {
  cd('{{release_path}}')
  run(pmInstall())
})

desc('Installs production-only dependencies')
task('nodejs:install:production', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

desc('Builds the application')
task('nodejs:build', () => {
  cd('{{release_path}}')
  run(`${bin(pm())} run build`)
})

desc('Runs the test suite')
task('nodejs:test', () => {
  cd('{{release_path}}')
  run(`${bin(pm())} test`)
})

after('deploy:shared', 'nodejs:install')
after('nodejs:install', 'nodejs:build')
