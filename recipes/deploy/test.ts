import type {} from '../../src/types.ts'
import { task, desc, cd, run, pm } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:test': true
  }
}

desc('Tests the application in the release')
task('deploy:test', () => {
  cd('{{release_path}}')
  run(`${pm()} run test`)
})
