/**
 * TYPE: local-build
 * DESCRIPTION:
 * This recipe builds a static Astro site locally then transfers the generated files to a remote server.
 */
import { type TaskContext, task, desc, local, get, set, before } from '../index.ts'
import { resolveHostStringValue } from '../src/utils.ts'

set('astro_mode', 'production')
set('source_path', './dist/.')

desc('Builds the Astro application locally')
task('deploy:build', async ({ host }: TaskContext) => {
  const mode = resolveHostStringValue(get('astro_mode'), host, 'astro_mode')
  await local(`astro build --mode ${mode}`)
})

before('deploy:lock', 'deploy:build')
