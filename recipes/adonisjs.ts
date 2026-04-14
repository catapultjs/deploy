import type {} from '../src/types.ts'
import {
  type TaskContext,
  task,
  desc,
  hasTask,
  cd,
  run,
  after,
  bin,
  get,
  set,
  pmInstall,
} from '../index.ts'
import { Strategy } from '../src/enums.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'adonisjs:install': true
    'adonisjs:build': true
    'adonisjs:migrate': true
  }
}

set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_dirs', ['storage', 'logs'])
set('shared_files', ['.env'])
set('adonisjs_path', '')

desc('Installs dependencies')
task('adonisjs:install', ({ config }: TaskContext) => {
  const adonisjs_path = get('adonisjs_path')
  if (config.strategy === Strategy.Build) {
    cd(`{{builder_path}}${adonisjs_path}`)
  } else {
    cd(`{{release_path}}${adonisjs_path}`)
  }
  run(pmInstall())
})

desc('Builds the AdonisJS application')
task('adonisjs:build', ({ config }: TaskContext) => {
  const adonisjs_path = get('adonisjs_path')
  if (config.strategy === Strategy.Build) {
    cd(`{{builder_path}}${adonisjs_path}`)
  } else {
    cd(`{{release_path}}${adonisjs_path}`)
  }
  run(`${bin('node')} ace build`)
})

desc('Runs database migrations')
task('adonisjs:migrate', ({ config }: TaskContext) => {
  const adonisjs_path = get('adonisjs_path')
  if (config.strategy === Strategy.Build) {
    cd(`{{builder_path}}${adonisjs_path}`)
  } else {
    cd(`{{release_path}}${adonisjs_path}`)
  }
  run(`${bin('node')} ace migration:run`)
})

after('deploy:shared', 'adonisjs:install')
after('adonisjs:install', 'adonisjs:build')

if (hasTask('deploy:build:copy')) {
  after('deploy:build:copy', 'adonisjs:migrate')
} else {
  after('adonisjs:build', 'adonisjs:migrate')
}
