/**
 * TYPE: local-build
 * DESCRIPTION:
 * This recipe builds a static Next.js app locally then transfers the exported files to a remote server.
 */
import { task, desc, set, before, local } from '../index.ts'

set('source_path', './out/.')

desc('Builds the Next.js application locally')
task('deploy:build', async () => {
  await local('next build')
})

before('deploy:lock', 'deploy:build')
