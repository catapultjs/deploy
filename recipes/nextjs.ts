/**
 * TYPE: remote-build
 * DESCRIPTION:
 * This recipe builds and deploys an AdonisJS app directly on the remote server.
 */
import type {} from '../src/types.ts'
import { task, desc, run, get, set, cd, after, pmExec, linkSharedPaths } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'nuxt:generate': true
  }
}

set('shared_files', ['.env'])
set('nextjs_path', get('source_path', ''))
set('nextjs_out_path', '.next/standalone/')

desc('Builds the Next.js app')
task('deploy:build', () => {
  const nextjsPath = get<string>('nextjs_path')
  cd(`{{release_path}}/${nextjsPath}`)
  run(`${pmExec('next')} build`)
})

desc('Symlinks shared directories and files into the release')
task('deploy:shared', () => {
  linkSharedPaths('{{release_path}}')

  const nextjsOutPath = get<string>('nextjs_out_path')
  run(`ln -sfn {{release_path}}/public {{current_path}}/${nextjsOutPath}`)
  run(`ln -sfn {{release_path}}/.next/static {{current_path}}/${nextjsOutPath}.next/`)
})

after('deploy:update_code', 'deploy:install')
after('deploy:shared', 'deploy:build')
