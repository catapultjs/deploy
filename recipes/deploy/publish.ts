import type {} from '../../src/types.ts'
import { task, desc, run } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:publish': true
  }
}

desc('Switches current symlink to the new release')
task('deploy:publish', () => {
  run('ln -sfn {{release_path}} {{current_path}}')
})
