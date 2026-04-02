import type {} from '../src/types.ts'
import { task, cd, run, after, bin, get, set, pmInstall } from '../index.ts'

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

task('adonisjs:install', () => {
  const adonisjs_path = get('adonisjs_path')
  cd(`{{release_path}}${adonisjs_path}`)
  run(pmInstall())
})

task('adonisjs:build', () => {
  const adonisjs_path = get('adonisjs_path')
  cd(`{{release_path}}${adonisjs_path}`)
  run(`${bin('node')} ace build`)
})

task('adonisjs:migrate', () => {
  const adonisjs_path = get('adonisjs_path')
  cd(`{{release_path}}${adonisjs_path}`)
  run(`${bin('node')} ace migration:run`)
})

after('deploy:shared', 'adonisjs:install')
after('adonisjs:install', 'adonisjs:build')
after('adonisjs:build', 'adonisjs:migrate')
