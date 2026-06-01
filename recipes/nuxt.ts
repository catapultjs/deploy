/**
 * TYPE: remote-build
 * DESCRIPTION:
 * This recipe builds and deploys an AdonisJS app directly on the remote server.
 */
import type {} from '../src/types.ts'
import { task, desc, run, get, set, cd, after, pmExec } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'nuxt:generate': true
  }
}

set('shared_files', ['.env'])
set('nuxt_path', get('source_path', ''))

desc('Builds the Nuxt app')
task('deploy:build', () => {
  const nuxtPath = get<string>('nuxt_path')
  cd(`{{release_path}}/${nuxtPath}`)
  run(`${pmExec('nuxt')} build`)
})

desc('Generates the Nuxt static files')
task('nuxt:generate', () => {
  const nuxtPath = get<string>('nuxt_path')
  cd(`{{release_path}}/${nuxtPath}`)
  run(`${pmExec('nuxt')} generate`)
})

after('deploy:update_code', 'deploy:install')
after('deploy:shared', 'deploy:build')
