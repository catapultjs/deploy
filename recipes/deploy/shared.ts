import type {} from '../../src/types.ts'
import { task, desc, linkSharedPaths } from '../../index.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:shared': true
  }
}

desc('Symlinks shared directories and files into the release')
task('deploy:shared', () => {
  linkSharedPaths('{{release_path}}')
})
