/**
 * TYPE: remote-build
 * DESCRIPTION:
 * This recipe builds and deploys a Next.js app directly on the remote server.
 */
import { task, desc, run, get, set, cd, after, pmExec } from '../index.ts'

set('shared_files', ['.env'])
set('nextjs_path', get('source_path', ''))
set('nextjs_out_path', '.next/standalone/')

desc('Builds the Next.js app')
task('deploy:build', () => {
  const nextjsPath = get<string>('nextjs_path')
  cd(`{{release_path}}/${nextjsPath}`)
  run(`${pmExec('next')} build`)

  const nextjsOutPath = get<string>('nextjs_out_path')
  run(`
    if [ -d {{release_path}}/${nextjsOutPath} ]; then
      ln -sfn {{release_path}}/public {{release_path}}/${nextjsOutPath}
      ln -sfn {{release_path}}/.next/static {{release_path}}/${nextjsOutPath}.next/
    fi
  `)
})

after('deploy:update_code', 'deploy:install')
after('deploy:shared', 'deploy:build')
