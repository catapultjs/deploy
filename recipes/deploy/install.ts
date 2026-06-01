import type {} from '../../src/types.ts'
import { task, desc, cd, run, pmInstall } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:install': true
  }
}

desc('Installs dependencies in the release')
task('deploy:install', () => {
  cd('{{release_path}}')
  run(pmInstall())
})
