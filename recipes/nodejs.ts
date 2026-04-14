import type {} from '../src/types.ts'
import {
  type TaskContext,
  task,
  hasTask,
  desc,
  cd,
  run,
  bin,
  after,
  pm,
  pmInstall,
  pmInstallProd,
} from '../index.ts'
import { Strategy } from '../src/enums.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'nodejs:install': true
    'nodejs:install:production': true
    'nodejs:build': true
    'nodejs:test': true
  }
}

desc('Installs dependencies with frozen lockfile')
task('nodejs:install', ({ config }: TaskContext) => {
  if (config.strategy === Strategy.Build) {
    cd('{{builder_path}}')
  } else {
    cd('{{release_path}}')
  }

  run(pmInstall())
})

desc('Installs production-only dependencies')
task('nodejs:install:production', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

desc('Builds the application')
task('nodejs:build', ({ config }: TaskContext) => {
  if (config.strategy === Strategy.Build) {
    cd('{{builder_path}}')
  } else {
    cd('{{release_path}}')
  }
  run(`${bin(pm())} run build`)
})

desc('Runs the test suite')
task('nodejs:test', ({ config }: TaskContext) => {
  if (config.strategy === Strategy.Build) {
    cd('{{builder_path}}')
  } else {
    cd('{{release_path}}')
  }
  run(`${bin(pm())} test`)
})

after('deploy:update_code', 'nodejs:install')
after('deploy:build:shared', 'nodejs:build')

if (hasTask('deploy:build:copy')) {
  after('deploy:build:copy', 'nodejs:install:production')
}
