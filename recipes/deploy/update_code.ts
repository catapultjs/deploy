import type {} from '../../src/types.ts'
import { task, desc } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:update_code': true
  }
}

desc('Method for updating code')
task('deploy:update_code', () => {
  throw new Error('Please implement this task')
})
