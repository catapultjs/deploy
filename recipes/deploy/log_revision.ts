import type {} from '../../src/types.ts'
import { type TaskContext, task, desc, isVerbose } from '../../index.ts'
import { Verbose } from '../../src/enums.ts'
import { q, ssh } from '../../src/utils.ts'
import { $ } from 'execa'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'deploy:log_revision': true
  }
}

desc('Appends branch, commit and user info to revisions.log')
task('deploy:log_revision', async ({ host, paths, release, logger }: TaskContext) => {
  let branch = typeof host.branch === 'object' ? host.branch.name : (host.branch ?? 'unknown')
  if (branch === 'unknown') {
    try {
      if (isVerbose(Verbose.TRACE)) logger.cmd('git rev-parse --abbrev-ref HEAD')
      const branchResult = await $`git rev-parse --abbrev-ref HEAD`
      branch = branchResult.stdout.trim()
    } catch {}
  }
  let commit = 'unknown'
  let user = 'unknown'

  try {
    if (isVerbose(Verbose.TRACE)) logger.cmd('git rev-parse HEAD')
    const commitResult = await $`git rev-parse HEAD`
    commit = commitResult.stdout.trim()
    if (isVerbose(Verbose.TRACE)) logger.cmd('git config user.name')
    const userResult = await $`git config user.name`
    user = userResult.stdout.trim()
  } catch {}

  const line = JSON.stringify({
    release,
    branch,
    commit,
    user,
    date: new Date().toISOString(),
  })
  const logFile = `${paths.cataConfig}/revisions.log`

  await ssh(host, `echo ${q(line)} >> ${q(logFile)}`)
})
