import type {} from '../src/types.ts'
import { task, desc, run, get, set, cd } from '../index.ts'

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
  run(`nuxt build`)
})

desc('Generates the Nuxt static files')
task('nuxt:generate', () => {
  const nuxtPath = get<string>('nuxt_path')
  cd(`{{release_path}}/${nuxtPath}`)
  run(`nuxt generate`)
})
