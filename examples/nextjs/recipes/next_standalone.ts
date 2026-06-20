import { task, desc, before, local, get, set } from '@catapultjs/deploy'

set('shared_files', get<string[]>('shared_files', ['.env']))
set('rsync_source_path', get<string>('rsync_source_path', '.next/standalone'))

desc('Builds Next.js standalone output locally and copies static assets')
task('deploy:build', async () => {
  await local('npx next build')
  // await local('cp -r .next/static .next/standalone/.next/static')
  await local('cp -r .next/static .next/standalone/examples/next/.next/static')
  await local('cp -r public .next/standalone/public')
})

before('deploy:lock', 'deploy:build')
