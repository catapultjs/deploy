import { task, desc, before, local, get, set } from '@catapultjs/deploy'

set('shared_files', get<string[]>('shared_files', ['.env.local']))
set('rsync_source_path', get<string>('rsync_source_path', '.next/standalone'))

desc('Builds Next.js standalone output locally and copies static assets')
task('deploy:build', () => {
  local('node --run build')
  local('cp -r .next/static .next/standalone/.next/static')
  local('cp -r public .next/standalone/public')
})

before('deploy:lock', 'deploy:build')
