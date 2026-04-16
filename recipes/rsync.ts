import type {} from '../src/types.ts'
import { $ } from 'execa'
import { type TaskContext, task, desc, get, isVerbose } from '../index.ts'
import { rsyncSshFlag, resolveSshArgs } from '../src/utils.ts'

desc('Transfers files to the release directory via rsync')
task('deploy:update_code', async ({ host, paths, logger }: TaskContext) => {
  const [target] = resolveSshArgs(host)
  const source = get('rsync_source_path', './')
  const args: string[] = ['-az', '-e', rsyncSshFlag(host)]
  for (const pattern of get<string[]>('rsync_excludes', [])) {
    args.push(`--exclude=${pattern}`)
  }
  if (isVerbose()) logger.cmd(`rsync ${args.join(' ')} ${source} ${target}:${paths.release}/`)
  await $`rsync ${args} ${source} ${target}:${paths.release}/`
})
