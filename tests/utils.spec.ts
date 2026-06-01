import { test } from '@japa/runner'
import { writeFile, rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Host } from '../src/types.ts'
import { findDeployFile, resolveHostStringValue } from '../src/utils.ts'

function makeHost(name = 'web-1'): Host {
  return {
    name,
    ssh: 'user@localhost',
    deployPath: '/home/deploy/app',
  }
}

test.group('utils — resolveHostStringValue', () => {
  test('returns the string value as-is', ({ assert }) => {
    assert.equal(resolveHostStringValue('production', makeHost(), 'astro_mode'), 'production')
  })

  test('returns the host-specific value from an object', ({ assert }) => {
    assert.equal(
      resolveHostStringValue(
        { 'web-1': 'staging', 'web-2': 'production' },
        makeHost(),
        'astro_mode'
      ),
      'staging'
    )
  })

  test('throws when the current host is missing from the object', ({ assert }) => {
    assert.throws(
      () => resolveHostStringValue({ 'web-2': 'production' }, makeHost(), 'astro_mode'),
      /\[web-1\] astro_mode must be a string or an object keyed by host name/
    )
  })
})

test.group('utils — findDeployFile', () => {
  test('detects deploy.config.ts', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-deploy-file-'))

    try {
      const file = join(cwd, 'deploy.config.ts')
      await writeFile(file, 'export default {}')

      assert.equal(await findDeployFile(cwd), file)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('detects deploy.config.js', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-deploy-file-'))

    try {
      const file = join(cwd, 'deploy.config.js')
      await writeFile(file, 'export default {}')

      assert.equal(await findDeployFile(cwd), file)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
