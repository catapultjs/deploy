/**
 * TYPE: local-build
 * DESCRIPTION:
 * This recipe builds a local project then transfers files to a remote server using scp.
 */
import { type TaskContext, task, desc, local, upload, get, set, before } from '../index.ts'
import { resolveHostStringValue } from '../src/utils.ts'

set('astro_mode', 'production')

desc('Builds the Astro application locally')
task('deploy:build', async ({ host }: TaskContext) => {
  const mode = resolveHostStringValue(get('astro_mode'), host, 'astro_mode')
  await local(`astro build --mode ${mode}`)
})

desc('Uploads local artifacts to the release directory')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  const source = get('source_path', './dist/.')
  await upload(source, paths.release)
})

before('deploy:lock', 'deploy:build')
