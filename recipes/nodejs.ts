import type {} from '../src/types.ts'
import { task, cd, run, bin, after, pm, pmInstall, pmInstallProd } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'nodejs:install': true
    'nodejs:install:production': true
    'nodejs:build': true
    'nodejs:test': true
  }
}

task('nodejs:install', () => {
  cd('{{release_path}}')
  run(pmInstall())
})

task('nodejs:install:production', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

task('nodejs:build', () => {
  cd('{{release_path}}')
  run(`${bin(pm())} run build`)
})

task('nodejs:test', () => {
  cd('{{release_path}}')
  run(`${bin(pm())} test`)
})

after('deploy:shared', 'nodejs:install')
after('nodejs:install', 'nodejs:build')
