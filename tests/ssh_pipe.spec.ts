import { test } from '@japa/runner'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { Readable } from 'node:stream'
import type { Host } from '../src/types.ts'
import { q, sshPipe } from '../src/utils.ts'

const host: Host = {
  name: 'test',
  ssh: 'deploy@example.test',
  deployPath: '/srv/app',
  multiplexing: false,
}

// Behaves like sshd: the remote command string is run by a shell, with stdin attached.
// HOME is isolated so `bash -l` does not source the developer's profile.
const FAKE_SSH = `#!${process.execPath}
const { spawnSync } = require('node:child_process')
const result = spawnSync('sh', ['-c', process.argv.at(-1)], {
  stdio: 'inherit',
  env: { ...process.env, HOME: process.env.SSH_PIPE_HOME },
})
process.exit(result.status ?? 1)
`

async function withFakeSsh(callback: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'cata-ssh-pipe-'))
  const path = process.env.PATH
  try {
    await writeFile(join(directory, 'ssh'), FAKE_SSH, { mode: 0o755 })
    process.env.PATH = `${directory}${delimiter}${path}`
    process.env.SSH_PIPE_HOME = directory
    await callback(directory)
  } finally {
    process.env.PATH = path
    delete process.env.SSH_PIPE_HOME
    await rm(directory, { recursive: true, force: true })
  }
}

async function* bytes(total: number, chunkSize = 64 * 1024) {
  for (let sent = 0; sent < total; sent += chunkSize) {
    yield Buffer.alloc(Math.min(chunkSize, total - sent), 'a')
  }
}

test.group('utils — sshPipe', () => {
  test('streams the source into the remote stdin', async ({ assert }) => {
    await withFakeSsh(async (directory) => {
      const file = join(directory, 'received')
      await sshPipe(host, `set -e\ncat > ${q(file)}`, Readable.from(['hello ', 'world']))
      assert.equal(await readFile(file, 'utf8'), 'hello world')
    })
  }).timeout(10_000)

  test('transfers large payloads completely', async ({ assert }) => {
    await withFakeSsh(async () => {
      const size = 8 * 1024 * 1024
      const { stdout } = await sshPipe(host, 'wc -c | tr -d " "', bytes(size))
      assert.equal(stdout.trim(), String(size))
    })
  }).timeout(20_000)

  test('reports the remote failure when the remote exits without reading', async ({ assert }) => {
    await withFakeSsh(async () => {
      try {
        await sshPipe(host, 'echo boom >&2\nexit 3', bytes(8 * 1024 * 1024))
        assert.fail('sshPipe should reject')
      } catch (error) {
        assert.equal((error as { exitCode?: number }).exitCode, 3)
        assert.include((error as { stderr?: string }).stderr ?? '', 'boom')
      }
    })
  }).timeout(20_000)

  test('rethrows a source failure and stops the transfer', async ({ assert }) => {
    await withFakeSsh(async (directory) => {
      async function* failing() {
        yield Buffer.from('partial')
        throw new Error('source failed')
      }
      await assert.rejects(
        () => sshPipe(host, `cat > ${q(join(directory, 'received'))}`, failing()),
        'source failed'
      )
    })
  }).timeout(10_000)

  test('aborts the transfer on signal', async ({ assert }) => {
    await withFakeSsh(async () => {
      async function* endless() {
        while (true) {
          yield Buffer.alloc(1024)
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 200)
      const started = Date.now()
      try {
        await sshPipe(host, 'cat > /dev/null', endless(), { signal: controller.signal })
        assert.fail('sshPipe should reject')
      } catch (error) {
        assert.notInclude((error as Error).message, 'should reject')
      }
      assert.isBelow(Date.now() - started, 5_000)
    })
  }).timeout(10_000)
})
