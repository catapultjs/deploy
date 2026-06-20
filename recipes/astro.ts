/**
 * TYPE: remote-build
 * DESCRIPTION:
 * This recipe builds and deploys a standalone Astro server app on the remote server.
 */
import { task, desc, cd, run, get, set, after, pmExec } from '../index.ts'

set('astro_path', get('source_path', ''))

desc('Builds the Astro application on the remote server')
task('deploy:build', () => {
  const astroPath = get<string>('astro_path')
  cd(`{{release_path}}/${astroPath}`)
  run(`${pmExec('astro')} build`)
})

after('deploy:update_code', 'deploy:install')
after('deploy:shared', 'deploy:build')
