import { $ } from 'execa'
import type {} from '../src/types.ts'
import { task, get, getContext, remove } from '../index.ts'

remove('deploy:check_branch')

declare module '../src/types.ts' {
  interface TaskRegistry {
    'deploy:upload': true
  }
}

task('deploy:upload', async () => {
  const { host, paths } = getContext()
  const args: string[] = ['-az']
  for (const pattern of get<string[]>('rsync_excludes', [])) {
    args.push(`--exclude=${pattern}`)
  }
  await $`rsync ${args} ./ ${host.ssh}:${paths.release}/`
})
