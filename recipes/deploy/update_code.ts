import type {} from '../../src/types.ts'
import { type TaskContext, task, desc, get, upload } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:update_code': true
  }
}

desc('Method for updating code')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  const source = get('source_path', './.')
  await upload(source, paths.release)
})
