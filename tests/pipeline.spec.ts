import { test } from '@japa/runner'
import {
  getPipeline,
  setPipeline,
  before,
  after,
  remove,
  inPipeline,
  onSetup,
  onStatus,
} from '../src/pipeline.ts'
import { hooks } from '../src/pipeline/hooks.ts'

const DEFAULT_PIPELINE = [
  'deploy:lock',
  'deploy:release',
  'deploy:update_code',
  'deploy:shared',
  'deploy:publish',
  'deploy:log_revision',
  'deploy:healthcheck',
  'deploy:unlock',
  'deploy:cleanup',
]

test.group('pipeline', (group) => {
  group.each.setup(() => setPipeline(DEFAULT_PIPELINE))

  test('getPipeline returns the default pipeline', ({ assert }) => {
    assert.deepEqual(getPipeline(), DEFAULT_PIPELINE)
  })

  test('getPipeline returns a copy, not a reference', ({ assert }) => {
    const a = getPipeline()
    const b = getPipeline()
    assert.notStrictEqual(a, b)
  })

  test('setPipeline replaces the entire pipeline', ({ assert }) => {
    setPipeline(['deploy:release', 'deploy:publish'])
    assert.deepEqual(getPipeline(), ['deploy:release', 'deploy:publish'])
  })

  test('before inserts a task before an existing one', ({ assert }) => {
    before('deploy:publish', 'my:task')
    const pipeline = getPipeline()
    const idx = pipeline.indexOf('my:task')
    assert.isAbove(idx, -1)
    assert.equal(pipeline[idx + 1], 'deploy:publish')
  })

  test('before throws when the reference task does not exist', ({ assert }) => {
    assert.throws(() => before('nonexistent:task', 'my:task'), /not found in pipeline/)
  })

  test('after inserts a task after an existing one', ({ assert }) => {
    after('deploy:publish', 'my:task')
    const pipeline = getPipeline()
    const idx = pipeline.indexOf('my:task')
    assert.isAbove(idx, -1)
    assert.equal(pipeline[idx - 1], 'deploy:publish')
  })

  test('after throws when the reference task does not exist', ({ assert }) => {
    assert.throws(() => after('nonexistent:task', 'my:task'), /not found in pipeline/)
  })

  test('remove removes a task from the pipeline', ({ assert }) => {
    remove('deploy:healthcheck')
    assert.notInclude(getPipeline(), 'deploy:healthcheck')
  })

  test('remove throws when the task does not exist', ({ assert }) => {
    assert.throws(() => remove('nonexistent:task'), /not found in pipeline/)
  })

  test('inPipeline returns true when task is present', ({ assert }) => {
    assert.isTrue(inPipeline('deploy:publish'))
  })

  test('inPipeline returns false when task is absent', ({ assert }) => {
    assert.isFalse(inPipeline('nonexistent:task'))
  })

  test('inPipeline reflects pipeline changes', ({ assert }) => {
    assert.isTrue(inPipeline('deploy:healthcheck'))
    remove('deploy:healthcheck')
    assert.isFalse(inPipeline('deploy:healthcheck'))
  })
})

test.group('pipeline — hooks', () => {
  test('onSetup registers a setup hook', ({ assert }) => {
    const count = hooks.getSetup().length
    onSetup(async () => {})
    assert.equal(hooks.getSetup().length, count + 1)
  })

  test('onStatus registers a status hook', ({ assert }) => {
    const count = hooks.getStatus().length
    onStatus(async () => {})
    assert.equal(hooks.getStatus().length, count + 1)
  })
})
