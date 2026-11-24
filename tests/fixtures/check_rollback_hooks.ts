import { strict as assert } from 'node:assert'
import { mkdir, symlink, readlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import '../../recipes/common.ts'
import { deployHost, rollbackHost } from '../../src/deployer.ts'
import { onBeforeRollback, onRollback, setPipeline } from '../../src/pipeline.ts'
import { task } from '../../src/task.ts'

const base = process.argv[2]
const host = { name: 'test', ssh: 'local', deployPath: base, multiplexing: false }
const ctx = { release: 'C', hooks: {}, config: { hosts: [host] } }
const current = join(base, 'current')
const previous = join(base, 'previous')

for (const release of ['A', 'B', 'C'])
  await mkdir(join(base, 'releases', release), { recursive: true })
await symlink(join(base, 'releases/B'), current)
await symlink(join(base, 'releases/A'), previous)

const calls: string[] = []
let refuse = false
const active = async () => basename(await readlink(current))

onBeforeRollback(async (hookCtx, hookHost) => {
  assert.equal(hookHost, host)
  calls.push(`before:${hookCtx.release}:${await active()}`)
  if (refuse) throw new Error('target refused')
})
onRollback(async (hookCtx) => {
  calls.push(`rollback:${hookCtx.release}:${await active()}`)
})
task('deploy:healthcheck', () => {
  calls.push('healthcheck')
})

// A refused target leaves current, previous and the restart hooks untouched.
setPipeline(['deploy:healthcheck'])
refuse = true
await assert.rejects(rollbackHost(ctx, host), /target refused/)
assert.equal(await active(), 'B')
assert.equal(basename(await readlink(previous)), 'A')
assert.deepEqual(calls, ['before:A:B'])

// Hooks receive the target release: validation before the switch, restart after it, then healthcheck.
refuse = false
calls.length = 0
await rollbackHost(ctx, host)
assert.equal(await active(), 'A')
assert.deepEqual(calls, ['before:A:B', 'rollback:A:A', 'healthcheck'])

// Automatic rollback after a failure post-publication runs the same hooks.
calls.length = 0
task('review:fail', () => {
  throw new Error('failure after publish')
})
setPipeline(['deploy:publish', 'review:fail', 'deploy:healthcheck'])
await assert.rejects(deployHost(ctx, host), /failure after publish/)
assert.equal(await active(), 'A')
assert.deepEqual(calls, ['before:A:C', 'rollback:A:A', 'healthcheck'])
