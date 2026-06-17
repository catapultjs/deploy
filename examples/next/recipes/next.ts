import { task, desc, after, cd, run, get, set, bin } from '@catapultjs/deploy'

set('shared_files', get<string[]>('shared_files', ['.env.local']))

desc('Builds the Next.js application in the release directory')
task('deploy:build', () => {
  const nextPath = get<string>('next_path', '')
  cd(nextPath ? `{{release_path}}/${nextPath}` : '{{release_path}}')
  run(`${bin('node')} --run build`)
})

after('deploy:update_code', 'deploy:install')
after('deploy:install', 'deploy:build')
