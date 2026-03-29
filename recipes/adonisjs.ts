import type {} from '../src/types.ts'
import { task, cd, run, after, bin, set } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'adonisjs:build': true
    'adonisjs:migrate': true
  }
}

set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_files', ['.env'])

task('adonisjs:build', () => {
  cd('{{release_path}}')
  run(`${bin('npm')} ci`)
  run(`${bin('node')} ace build`)
  run(
    `if [ -f package-lock.tson ]; then ${bin('npm')} ci --omit=dev; else ${bin('npm')} install --omit=dev; fi`
  )
})

task('adonisjs:migrate', () => {
  cd('{{release_path}}')
  run(`${bin('node')} ace migration:run`)
})

after('deploy:shared', 'adonisjs:build')
after('adonisjs:build', 'adonisjs:migrate')
