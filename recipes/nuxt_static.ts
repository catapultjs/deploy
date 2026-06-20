/**
 * TYPE: local-build
 * DESCRIPTION:
 * This recipe builds a static Nuxt site locally then transfers the generated files to a remote server.
 */
import { task, desc, set, before, local } from '../index.ts'

set('source_path', './.output/public/.')

desc('Builds the Nuxt application locally')
task('deploy:build', async () => {
  await local(`nuxt generate`)
})

before('deploy:lock', 'deploy:build')
