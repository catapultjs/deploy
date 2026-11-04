import { Catapult } from '../../src/api.ts'
import { strict as assert } from 'node:assert'
import { mkdir, symlink, readlink, lstat, writeFile, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import '../../recipes/common.ts'
import { deployHost, rollbackHost } from '../../src/deployer.ts'
import { setPipeline } from '../../src/pipeline.ts'
import { task, runTask } from '../../src/task.ts'

const base = process.argv[2]
const host = { name: 'test', ssh: 'local', deployPath: base, multiplexing: false }
const ctx = { release: 'B', hooks: {}, config: { hosts: [host] } }
await mkdir(join(base, 'releases/A'), { recursive: true })
await mkdir(join(base, 'releases/B'), { recursive: true })
await symlink(join(base, 'releases/A'), join(base, 'current'))
setPipeline(['deploy:publish'])
process.env.ROLLBACK_FAIL_READ = '1'
await assert.rejects(deployHost(ctx, host))
assert.equal(await readlink(join(base, 'current')), join(base, 'releases/A'))
delete process.env.ROLLBACK_FAIL_READ
await runTask('deploy:publish', ctx, host)
setPipeline([])
await assert.rejects(rollbackHost(ctx, host, 'B'), /already current/)
await rollbackHost(ctx, host)
assert.equal(await readlink(join(base, 'current')), join(base, 'releases/A'))
await assert.rejects(lstat(join(base, 'previous')), { code: 'ENOENT' })
await assert.rejects(rollbackHost(ctx, host), /no previous release/)
await assert.rejects(rollbackHost(ctx, host, 'missing'))
assert.equal(await readlink(join(base, 'current')), join(base, 'releases/A'))

// Retention must preserve a stable release even when failed releases are newer.
await mkdir(join(base, 'releases/C'), { recursive: true })
await mkdir(join(base, 'releases/D'), { recursive: true })
await symlink(join(base, 'releases/B'), join(base, 'previous'))
await runTask('deploy:cleanup', { ...ctx, config: { ...ctx.config, keepReleases: 1 } }, host)
await lstat(join(base, 'releases/A'))
await lstat(join(base, 'releases/B'))
await lstat(join(base, 'releases/D'))
await assert.rejects(lstat(join(base, 'releases/C')), { code: 'ENOENT' })

// The API must preserve a competing lock and release its own on success or failure.
await mkdir(join(base, '.catapult'))
const lock = join(base, '.catapult/deploy.lock')
const api = new Catapult({ hosts: [host], verbose: 0 })
await writeFile(lock, 'another-deployment')
await assert.rejects(api.rollback({ release: 'B' }), /Deploy lock already present/)
assert.equal(await readFile(lock, 'utf8'), 'another-deployment')
assert.equal(await readlink(join(base, 'current')), join(base, 'releases/A'))
await unlink(lock)
await api.rollback({ release: 'B' })
assert.equal(await readlink(join(base, 'current')), join(base, 'releases/B'))
await assert.rejects(lstat(lock), { code: 'ENOENT' })
await assert.rejects(api.rollback({ release: 'missing' }))
await assert.rejects(lstat(lock), { code: 'ENOENT' })
assert.equal(await readlink(join(base, 'current')), join(base, 'releases/B'))

// A failure after an explicit unlock must not release somebody else's lock.
let unlocks = 0
task('deploy:lock', () => {})
task('deploy:unlock', () => {
  unlocks++
})
task('review:fail', () => {
  throw new Error('failure after unlock')
})
setPipeline(['deploy:lock', 'deploy:unlock', 'review:fail'])
await assert.rejects(deployHost(ctx, host), /failure after unlock/)
assert.equal(unlocks, 1)

// A cleanup failure still releases our lock.
unlocks = 0
task('deploy:cleanup', () => {
  throw new Error('cleanup failed')
})
setPipeline(['deploy:lock', 'deploy:cleanup', 'deploy:unlock'])
await assert.rejects(deployHost(ctx, host), /cleanup failed/)
assert.equal(unlocks, 1)
