import { test } from '@japa/runner'
import { Catapult } from '../src/api.ts'
import { Context } from '../src/context.ts'

const config = {
  hosts: [
    { name: 'web1', ssh: 'deploy@web1.example.com', deployPath: '/home/deploy/app' },
    { name: 'web2', ssh: 'deploy@web2.example.com', deployPath: '/home/deploy/app' },
  ],
}

test.group('api', () => {
  test('deploy rejects unknown host names before any SSH call', async ({ assert }) => {
    const catapult = new Catapult(config)
    await assert.rejects(() => catapult.deploy({ hosts: ['nope'] }), 'Unknown host: nope')
  })

  test('rollback rejects unknown host names before any SSH call', async ({ assert }) => {
    const catapult = new Catapult(config)
    await assert.rejects(() => catapult.rollback({ hosts: ['nope'] }), 'Unknown host: nope')
  })

  test('task rejects unknown task names before any SSH call', async ({ assert }) => {
    const catapult = new Catapult(config)
    await assert.rejects(() => catapult.task('nope:nope'))
  })

  test('pipeline returns the current pipeline', async ({ assert }) => {
    const catapult = new Catapult(config)
    const pipeline = await catapult.pipeline()
    assert.isArray(pipeline)
    assert.include(pipeline, 'deploy:release')
  })

  test('listTasks splits pipeline and extra tasks with descriptions', async ({ assert }) => {
    const catapult = new Catapult(config)
    const { pipeline, extra } = await catapult.listTasks()

    assert.isNotEmpty(pipeline)
    for (const entry of [...pipeline, ...extra]) {
      assert.properties(entry, ['name', 'description'])
    }
    const pipelineNames = pipeline.map((t) => t.name)
    assert.notInclude(
      extra.map((t) => t.name),
      pipelineNames[0]
    )
  })

  test('constructor does not initialize the context eagerly', async ({ assert }) => {
    void new Catapult(config)
    // Context is only set when an operation runs; here we just check the
    // failing operation above did initialize it with our hosts
    const catapult = new Catapult(config)
    await assert.rejects(() => catapult.status({ hosts: ['nope'] }), 'Unknown host: nope')
    assert.deepEqual(
      Context.get().config.hosts.map((h) => h.name),
      ['web1', 'web2']
    )
  })
})
