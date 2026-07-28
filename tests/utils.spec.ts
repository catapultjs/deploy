import { test } from '@japa/runner'
import { writeFile, rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Host } from '../src/types.ts'
import {
  findDeployFile,
  identityArgs,
  isSshConnectionError,
  resolveHostStringValue,
  resolveSshArgs,
  rsyncSshFlag,
  scpArgs,
  sshControlArgs,
  sshErrorMessage,
  useMultiplexing,
} from '../src/utils.ts'

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

test.group('utils — identityFile', () => {
  test('returns no args when ssh is a string alias', ({ assert }) => {
    assert.deepEqual(identityArgs(makeHost()), [])
  })

  test('returns no args when the object form omits identityFile', ({ assert }) => {
    const host: Host = { ...makeHost(), ssh: { user: 'deploy', host: 'example.com' } }
    assert.deepEqual(identityArgs(host), [])
  })

  test('injects -i and IdentitiesOnly=yes in the object form', ({ assert }) => {
    const host: Host = {
      ...makeHost(),
      ssh: { user: 'deploy', host: 'example.com', identityFile: '~/.ssh/deploy_ed25519' },
    }
    assert.deepEqual(identityArgs(host), [
      '-i',
      '~/.ssh/deploy_ed25519',
      '-o',
      'IdentitiesOnly=yes',
    ])
  })

  test('resolveSshArgs places -p, -i and IdentitiesOnly before the target', ({ assert }) => {
    const host: Host = {
      ...makeHost(),
      ssh: { user: 'deploy', host: 'example.com', port: 2222, identityFile: '/keys/id' },
    }
    assert.deepEqual(resolveSshArgs(host), [
      '-p',
      '2222',
      '-i',
      '/keys/id',
      '-o',
      'IdentitiesOnly=yes',
      'deploy@example.com',
    ])
  })

  test('scpArgs and rsyncSshFlag carry the key path exclusively', ({ assert }) => {
    const host: Host = {
      ...makeHost(),
      multiplexing: false,
      ssh: { user: 'deploy', host: 'example.com', port: 2222, identityFile: '/keys/id' },
    }
    assert.deepEqual(scpArgs(host), ['-P', '2222', '-i', '/keys/id', '-o', 'IdentitiesOnly=yes'])
    assert.equal(rsyncSshFlag(host), 'ssh -p 2222 -i /keys/id -o IdentitiesOnly=yes')
  })
})

test.group('utils — multiplexing', () => {
  test('respects an explicit multiplexing:true', ({ assert }) => {
    const host: Host = { ...makeHost(), multiplexing: true }
    assert.isTrue(useMultiplexing(host))
    assert.deepEqual(sshControlArgs(host), [
      '-o',
      'ControlMaster=auto',
      '-o',
      sshControlArgs(host)[3],
      '-o',
      'ControlPersist=300',
    ])
    assert.match(sshControlArgs(host)[3], /^ControlPath=.*cata-[0-9a-f]{8}\.sock$/)
  })

  test('respects an explicit multiplexing:false (no control args)', ({ assert }) => {
    const host: Host = { ...makeHost(), multiplexing: false }
    assert.isFalse(useMultiplexing(host))
    assert.deepEqual(sshControlArgs(host), [])
  })

  test('defaults to the platform (off on Windows, on elsewhere)', ({ assert }) => {
    assert.equal(useMultiplexing(makeHost()), process.platform !== 'win32')
  })
})

test.group('utils — isSshConnectionError', () => {
  test('treats exit 255 as a connection/transport error', ({ assert }) => {
    assert.isTrue(isSshConnectionError({ exitCode: 255 }))
  })

  test('treats a missing exit code as a connection error', ({ assert }) => {
    assert.isTrue(isSshConnectionError({}))
    assert.isTrue(isSshConnectionError(new Error('spawn ssh ENOENT')))
  })

  test('treats a remote non-zero exit as NOT a connection error', ({ assert }) => {
    assert.isFalse(isSshConnectionError({ exitCode: 1 }))
    assert.isFalse(isSshConnectionError({ exitCode: 127 }))
  })
})

test.group('utils — sshErrorMessage', () => {
  test('prefers the trimmed stderr', ({ assert }) => {
    assert.equal(
      sshErrorMessage({ stderr: '\nPermission denied (publickey).\n', message: 'Command failed' }),
      'Permission denied (publickey).'
    )
  })

  test('falls back to shortMessage then message', ({ assert }) => {
    assert.equal(sshErrorMessage({ stderr: '', shortMessage: 'short' }), 'short')
    assert.equal(sshErrorMessage({ message: 'boom' }), 'boom')
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

  test('detects deploy.config.json', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-deploy-file-'))

    try {
      const file = join(cwd, 'deploy.config.json')
      await writeFile(file, '{}')

      assert.equal(await findDeployFile(cwd), file)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('detects deploy.json', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-deploy-file-'))

    try {
      const file = join(cwd, 'deploy.json')
      await writeFile(file, '{}')

      assert.equal(await findDeployFile(cwd), file)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('keeps TypeScript config precedence over JSON', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-deploy-file-'))

    try {
      const typescriptFile = join(cwd, 'deploy.config.ts')
      await writeFile(join(cwd, 'deploy.config.json'), '{}')
      await writeFile(typescriptFile, 'export default {}')

      assert.equal(await findDeployFile(cwd), typescriptFile)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
