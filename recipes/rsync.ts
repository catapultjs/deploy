import type {} from '../src/types.ts'
import { $ } from 'execa'
import { type TaskContext, task, get, isVerbose, yellow } from '../index.ts'
import { rsyncSshFlag, resolveSshArgs } from '../src/utils.ts'

task('deploy:update_code', async ({ host, paths }: TaskContext) => {
  const [target] = resolveSshArgs(host)
  const source = get('rsync_source_path', './')
  const args: string[] = ['-az', '-e', rsyncSshFlag(host)]
  for (const pattern of get<string[]>('rsync_excludes', [])) {
    args.push(`--exclude=${pattern}`)
  }
  if (isVerbose())
    console.log(yellow(`    $ rsync ${args.join(' ')} ${source} ${target}:${paths.release}/`))
  await $`rsync ${args} ${source} ${target}:${paths.release}/`
})
