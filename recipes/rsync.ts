import { $ } from 'execa'
import type {} from '../src/types.ts'
import { task, get, getContext, isVerbose, yellow } from '../index.ts'
import { rsyncSshFlag, resolveSshArgs } from '../src/utils.ts'

task('deploy:update_code', async () => {
  const { host, paths } = getContext()
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
