import type {} from '../src/types.ts'
import { $ } from 'execa'
import { type TaskContext, task, after, isVerbose, yellow, q } from '../index.ts'
import { ssh } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'git:check': true
  }
}

task('git:check', async ({ host, deployCtx }: TaskContext) => {
  if (!host.branch) return

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch

  let repository = deployCtx.config.repository
  if (!repository) {
    if (isVerbose()) console.log(yellow('    $ git remote get-url origin'))
    repository = (await $`git remote get-url origin`).stdout.trim()
  }

  try {
    if (isVerbose())
      console.log(yellow(`    $ git ls-remote --exit-code --heads ${repository} ${branchName}`))
    await $`git ls-remote --exit-code --heads ${repository} ${branchName}`
  } catch {
    throw new Error(`[${host.name}] branch "${branchName}" does not exist on remote ${repository}`)
  }
})

task('deploy:update_code', async ({ host, paths, deployCtx }: TaskContext) => {
  if (!host.branch) throw new Error(`[${host.name}] git mode requires "branch" on host`)

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch

  let repository = deployCtx.config.repository
  if (!repository) {
    if (isVerbose()) console.log(yellow('    $ git remote get-url origin'))
    repository = (await $`git remote get-url origin`).stdout.trim()
  }

  await ssh(
    host,
    `set -e\ngit clone --depth 1 --branch ${q(branchName)} ${q(repository)} ${q(paths.release)}`
  )
})

task('deploy:log_revision', async ({ host, deployCtx }: TaskContext) => {
  const branch = typeof host.branch === 'object' ? host.branch.name : (host.branch ?? 'unknown')
  let commit = 'unknown'
  let user = 'unknown'

  try {
    if (isVerbose()) console.log(yellow('    $ git rev-parse HEAD'))
    commit = (await $`git rev-parse HEAD`).stdout.trim()
    if (isVerbose()) console.log(yellow('    $ git config user.name'))
    user = (await $`git config user.name`).stdout.trim()
  } catch {}

  const line = `Branch ${branch} (at ${commit}) deployed as release ${deployCtx.release} by ${user}`
  const logFile = `${host.deployPath}/revisions.log`

  await ssh(host, `echo ${q(line)} >> ${q(logFile)}`)
})

after('deploy:lock', 'git:check')
