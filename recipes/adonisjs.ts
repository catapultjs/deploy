import type {} from '../src/types.ts'
import {
  type TaskContext,
  task,
  desc,
  cd,
  run,
  after,
  before,
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
  const adonisjsPath = get('adonisjs_path')
  if (config.strategy === Strategy.Build) {
    cd(`{{builder_path}}${adonisjsPath}`)
  } else {
    cd(`{{release_path}}${adonisjsPath}`)
  }
  run(pmInstall())
})

desc('Builds the AdonisJS application')
task('adonisjs:build', ({ config }: TaskContext) => {
  const adonisjsPath = get('adonisjs_path')
  if (config.strategy === Strategy.Build) {
    cd(`{{builder_path}}${adonisjsPath}`)
  } else {
    cd(`{{release_path}}${adonisjsPath}`)
  }
  run(`${bin('node')} ace build`)
})

desc('Runs database migrations')
task('adonisjs:migrate', ({ config }: TaskContext) => {
  const adonisjsPath = get('adonisjs_path')
  if (config.strategy === Strategy.Build) {
    cd(`{{builder_path}}${adonisjsPath}`)
  } else {
    cd(`{{release_path}}${adonisjsPath}`)
  }
  run(`${bin('node')} ace migration:run --force`)
})

after('deploy:shared', 'adonisjs:install')
after('adonisjs:install', 'adonisjs:build')
before('deploy:publish', 'adonisjs:migrate')
