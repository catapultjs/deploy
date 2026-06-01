/**
 * TYPE: local-build
 * DESCRIPTION:
 * This recipe builds a local project then transfers files to a remote server using scp.
 */
import { type TaskContext, task, desc, local, upload, get, set, before } from '../index.ts'

set('vitepress_path', get('source_path', ''))

desc('Builds the vitepress application locally')
task('deploy:build', async () => {
  const vitepressPath = get<string>('vitepress_path')
  await local(`vitepress build ${vitepressPath}`)
})

desc('Uploads local artifacts to the release directory')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  const vitepressPath = get<string>('vitepress_path') + '.vitepress/dist/.'
  await upload(vitepressPath, paths.release)
})

before('deploy:lock', 'deploy:build')
