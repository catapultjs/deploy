import type {} from '../../src/types.ts'
import { task, desc, run } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:release': true
  }
}

desc('Creates the release directory on the server')
task('deploy:release', () => {
  run('mkdir -p {{release_path}}')
})
