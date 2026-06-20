import type {} from '../../src/types.ts'
import { type TaskContext, task, desc, get, upload } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:update_code': true
  }
}

desc('Uploads local artifacts to the release directory')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  const source = get('source_path', './.')
  await upload(source, paths.release)
})
