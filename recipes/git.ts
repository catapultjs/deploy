import type {} from '../src/types.ts'
import { $ } from 'execa'
import { type TaskContext, task, desc, after, isVerbose } from '../index.ts'
import { ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'git:check': true
  }
}

desc('Verifies the branch exists on the remote repository')
task('git:check', async ({ host, deployCtx, logger }: TaskContext) => {
  if (!host.branch) return

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch

  let repository = deployCtx.config.repository
  if (!repository) {
    if (isVerbose()) logger.cmd('git remote get-url origin')
    repository = (await $`git remote get-url origin`).stdout.trim()
  }

  try {
    if (isVerbose())
      logger.cmd(`git ls-remote --exit-code --heads ${repository} ${branchName}`)
    await $`git ls-remote --exit-code --heads ${repository} ${branchName}`
  } catch {
    throw new Error(`[${host.name}] branch "${branchName}" does not exist on remote ${repository}`)
  }
})

desc('Clones the repository into the release directory')
task('deploy:update_code', async ({ host, paths, deployCtx, logger }: TaskContext) => {
  if (!host.branch) throw new Error(`[${host.name}] git mode requires "branch" on host`)

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch

  let repository = deployCtx.config.repository
  if (!repository) {
    if (isVerbose()) logger.cmd('git remote get-url origin')
    repository = (await $`git remote get-url origin`).stdout.trim()
  }

  await ssh(
    host,
    `set -e\ngit clone --depth 1 --branch ${q(branchName)} ${q(repository)} ${q(paths.release)}`
  )
})

after('deploy:lock', 'git:check')
