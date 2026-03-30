import type {} from '../src/types.ts'
import { task, cd, run, after, bin, get, set } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'adonisjs:build': true
    'adonisjs:migrate': true
  }
}

set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_dirs', ['storage', 'logs'])
set('shared_files', ['.env'])
set('adonisjs_path', '')

task('adonisjs:build', () => {
  const adonisjs_path = get('adonisjs_path')
  cd(`{{release_path}}${adonisjs_path}`)
  run(`${bin('npm')} ci`)
  run(`${bin('node')} ace build`)
  run(
    `if [ -f package-lock.tson ]; then ${bin('npm')} ci --omit=dev; else ${bin('npm')} install --omit=dev; fi`
  )
})

task('adonisjs:migrate', () => {
  const adonisjs_path = get('adonisjs_path')
  cd(`{{release_path}}${adonisjs_path}`)
  run(`${bin('node')} ace migration:run`)
})

after('deploy:shared', 'adonisjs:build')
after('adonisjs:build', 'adonisjs:migrate')
