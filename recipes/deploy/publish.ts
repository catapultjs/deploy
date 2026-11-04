import type {} from '../../src/types.ts'
import { task, desc, run } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:publish': true
  }
}

desc('Switches current symlink to the new release')
task('deploy:publish', () => {
  run(
    'if [ -L {{current_path}} ]; then ln -sfn "$(readlink {{current_path}})" {{base_path}}/previous; else rm -f {{base_path}}/previous; fi'
  )
  run('ln -sfn {{release_path}} {{current_path}}')
})
