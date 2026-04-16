import { test } from '@japa/runner'
import { set, get, has } from '../src/store.ts'

test.group('store', () => {
  test('get returns undefined when key is not set', ({ assert }) => {
    assert.isUndefined(get('store__unset_key'))
  })

  test('get returns default value when key is not set', ({ assert }) => {
    assert.equal(get('store__missing', 'fallback'), 'fallback')
  })

  test('set and get a string value', ({ assert }) => {
    set('store__str', 'hello')
    assert.equal(get('store__str'), 'hello')
  })

  test('set overwrites existing value', ({ assert }) => {
    set('store__overwrite', 'first')
    set('store__overwrite', 'second')
    assert.equal(get('store__overwrite'), 'second')
  })

  test('set value takes priority over default', ({ assert }) => {
    set('store__priority', 'actual')
    assert.equal(get('store__priority', 'fallback'), 'actual')
  })

  test('set and get a number', ({ assert }) => {
    set('store__num', 42)
    assert.equal(get<number>('store__num'), 42)
  })

  test('set and get a boolean', ({ assert }) => {
    set('store__bool', true)
    assert.isTrue(get<boolean>('store__bool'))
  })

  test('set and get an array', ({ assert }) => {
    set('store__arr', [1, 2, 3])
    assert.deepEqual(get<number[]>('store__arr'), [1, 2, 3])
  })

  test('set and get an object', ({ assert }) => {
    set('store__obj', { a: 1, b: 'x' })
    assert.deepEqual(get<object>('store__obj'), { a: 1, b: 'x' })
  })

  test('has returns false when key is not set', ({ assert }) => {
    assert.isFalse(has('store__has_missing'))
  })

  test('has returns true after set', ({ assert }) => {
    set('store__has_key', 'value')
    assert.isTrue(has('store__has_key'))
  })

  test('has returns true for falsy values', ({ assert }) => {
    set('store__has_falsy', false)
    assert.isTrue(has('store__has_falsy'))
  })
})
