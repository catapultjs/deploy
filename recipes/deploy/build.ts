import type {} from '../../src/types.ts'
import { task, desc, cd, run, pm } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:build': true
  }
}

desc('Builds the application in the release')
task('deploy:build', () => {
  cd('{{release_path}}')
  run(`${pm()} run build`)
})
