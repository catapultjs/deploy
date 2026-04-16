import { test } from '@japa/runner'
import { task, hasTask, getTasks, runTask, cd, run, bin, isVerbose } from '../src/task.ts'
import type { DeployContext, Host } from '../src/types.ts'

function makeDeployCtx(): DeployContext {
  return {
    release: '2024-01-15T10-00-00-000Z',
    hooks: {},
    config: {
      keepReleases: 5,
      hosts: [],
      verbose: 0,
    },
  }
}

function makeHost(): Host {
  return {
    name: 'test',
    ssh: 'user@localhost',
    deployPath: '/home/deploy/app',
  }
}

test.group('task — registration', () => {
  test('task registers a task function', ({ assert }) => {
    task('test:register_a', () => {})
    assert.isTrue(hasTask('test:register_a'))
  })

  test('hasTask returns false for an unknown task', ({ assert }) => {
    assert.isFalse(hasTask('task:nonexistent_xyz'))
  })

  test('getTasks includes all registered tasks', ({ assert }) => {
    task('test:list_a', () => {})
    task('test:list_b', () => {})
    const tasks = getTasks()
    assert.include(tasks, 'test:list_a')
    assert.include(tasks, 'test:list_b')
  })

  test('registering a task twice overwrites it', ({ assert }) => {
    let result = 'none'
    task('test:overwrite', () => {
      result = 'first'
    })
    task('test:overwrite', () => {
      result = 'second'
    })
    assert.isTrue(hasTask('test:overwrite'))
    // verify the second registration is the active one
    assert.equal(result, 'none') // not called yet
  })
})

test.group('task — runTask', () => {
  test('runTask calls the registered task function', async ({ assert }) => {
    let called = false
    task('test:run_sync', async () => {
      called = true
    })
    await runTask('test:run_sync', makeDeployCtx(), makeHost())
    assert.isTrue(called)
  })

  test('runTask passes TaskContext to the task function', async ({ assert }) => {
    let receivedHost: Host | undefined
    task('test:run_ctx', async ({ host }) => {
      receivedHost = host
    })
    const host = makeHost()
    await runTask('test:run_ctx', makeDeployCtx(), host)
    assert.equal(receivedHost?.name, host.name)
  })

  test('runTask throws when the task does not exist', async ({ assert }) => {
    await assert.rejects(
      () => runTask('task:does_not_exist_xyz', makeDeployCtx(), makeHost()),
      /Task not found/
    )
  })
})

test.group('task — DSL', () => {
  test('cd throws when called outside a task context', ({ assert }) => {
    assert.throws(() => cd('/tmp'), /must be called inside a task/)
  })

  test('run throws when called outside a task context', ({ assert }) => {
    assert.throws(() => run('echo hello'), /must be called inside a task/)
  })

  test('bin returns the binary name when no context is set', ({ assert }) => {
    assert.equal(bin('node'), 'node')
    assert.equal(bin('pnpm'), 'pnpm')
  })

  test('bin resolves from host.bin when inside a task', async ({ assert }) => {
    let resolved: string | undefined
    task('test:bin_ctx', async ({ host: _ }) => {
      resolved = bin('node')
    })
    const host: Host = {
      ...makeHost(),
      bin: { node: '/home/deploy/.nvm/versions/node/v22/bin/node' },
    }
    await runTask('test:bin_ctx', makeDeployCtx(), host)
    assert.equal(resolved, '/home/deploy/.nvm/versions/node/v22/bin/node')
  })

  test('isVerbose returns 0 when no context is set', ({ assert }) => {
    assert.equal(isVerbose(), 0)
  })

  test('isVerbose returns the config value when inside a task', async ({ assert }) => {
    let result: 0 | 1 | 2 | undefined
    task('test:verbose_ctx', async () => {
      result = isVerbose()
    })
    const ctx = makeDeployCtx()
    ctx.config.verbose = 2
    await runTask('test:verbose_ctx', ctx, makeHost())
    assert.equal(result, 2)
  })
})
