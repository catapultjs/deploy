import type {} from '../src/types.ts'
import { task, desc, cd, run, after, before, bin, get, set, linkSharedPaths } from '../index.ts'
import './common.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'adonisjs:build:shared': true
    'ace:migration:run': true
    'ace:migration:rollback': true
    'ace:migration:status': true
    'ace:list:routes': true
  }
}

set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_dirs', ['storage', 'logs'])
set('shared_files', ['.env'])
set('adonisjs_path', '')

const ace =
  (command: string, options: string[] = []) =>
  () => {
    const adonisjsPath = get<string>('adonisjs_path')
    cd(`{{release_path}}/${adonisjsPath}`)
    run(`${bin('node')} ace ${command} ${options.join(' ')}`)
  }

desc('Builds the AdonisJS application')
task('deploy:build', async () => {
  const adonisjsPath = get<string>('adonisjs_path')
  cd(`{{release_path}}/${adonisjsPath}`)
  run(`${bin('node')} ace build`)
  run(`mkdir ./build/tmp`)

  linkSharedPaths(`{{release_path}}/${adonisjsPath}/build`)
})

desc('Adds shared paths to the build directory')
task('adonisjs:build:shared', () => {
  const adonisjsPath = get<string>('adonisjs_path')
  run(`mkdir ./build/tmp`)
  linkSharedPaths(`{{builder_path}}/${adonisjsPath}/build`)
})

desc('Runs database migrations')
task('ace:migration:run', ace('migration:run', ['--force']))

desc('Rolls back database migrations')
task('ace:migration:rollback', ace('migration:rollback'))

desc('Shows the status of database migrations')
task('ace:migration:status', ace('migration:status'))

desc('Lists all routes')
task('ace:list:routes', ace('list:routes'))

desc('Generates a new application key')
task('ace:generate:key', ace('generate:key'))

after('deploy:update_code', 'deploy:install')
after('deploy:shared', 'deploy:build')
before('deploy:publish', 'ace:migration:run')
