import type {} from '../src/types.ts'
import { $ } from 'execa'
import { Strategy } from '../src/enums.ts'
import { type TaskContext, task, desc, after, before, isVerbose } from '../index.ts'
import { ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'git:check': true
    'git:update': true
  }
}

desc('Verifies the branch exists on the remote repository')
task('git:check', async ({ host, config, logger }: TaskContext) => {
  if (!host.branch) return

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch

  let repository = config.repository
  if (!repository) {
    if (isVerbose()) logger.cmd('git remote get-url origin')
    const result = await $`git remote get-url origin`
    repository = result.stdout.trim()
  }

  try {
    if (isVerbose()) logger.cmd(`git ls-remote --exit-code --heads ${repository} ${branchName}`)
    await $`git ls-remote --exit-code --heads ${repository} ${branchName}`
  } catch {
    throw new Error(`[${host.name}] branch "${branchName}" does not exist on remote ${repository}`)
  }
})

desc('Clones the repository or fetches and resets if the target already exists')
task('deploy:update_code', async ({ host, paths, config, logger }: TaskContext) => {
  if (!host.branch) throw new Error(`[${host.name}] git mode requires "branch" on host`)

  const branchName = typeof host.branch === 'object' ? host.branch.name : host.branch
  const cache = paths.repo
  const target = config.strategy === Strategy.Build ? paths.builder : paths.release

  const targetExists = await ssh(host, `[ -d ${q(target + '/.git')} ] && echo 'yes' || echo 'no'`, {
    quiet: true,
  })

  if (targetExists.stdout.trim() === 'yes') {
    if (isVerbose()) logger.cmd(`git fetch ${branchName} + reset --hard FETCH_HEAD → ${target}`)
    await ssh(
      host,
      `set -e\ngit -C ${q(target)} fetch origin ${q(branchName)}\ngit -C ${q(target)} reset --hard FETCH_HEAD`
    )
  } else {
    if (isVerbose()) logger.cmd(`git clone ${branchName} → ${target}`)
    await ssh(host, `set -e\ngit clone --local --branch ${q(branchName)} ${q(cache)} ${q(target)}`)
  }
})

desc('Clones the repository or fetches and checks out if it already exists')
task('git:update', async ({ host, paths, config, logger }: TaskContext) => {
  if (!host.branch) throw new Error(`[${host.name}] git:update requires "branch" on host`)

  let repository = config.repository
  const cache = paths.repo

  if (!repository) {
    if (isVerbose()) logger.cmd('git remote get-url origin')
    const result = await $`git remote get-url origin`
    repository = result.stdout.trim()
  }

  const cacheExists = await ssh(host, `[ -d ${q(cache)} ] && echo 'yes' || echo 'no'`, {
    quiet: true,
  })

  if (cacheExists.stdout.trim() === 'yes') {
    if (isVerbose()) logger.cmd(`git fetch ${repository}`)
    await ssh(host, `set -e\ngit -C ${q(cache)} fetch --all --prune`)
  } else {
    if (isVerbose()) logger.cmd(`git clone --mirror ${repository}`)
    await ssh(host, `set -e\ngit clone --mirror ${q(repository)} ${q(cache)}`)
  }
})

after('deploy:lock', 'git:check')
before('deploy:update_code', 'git:update')
