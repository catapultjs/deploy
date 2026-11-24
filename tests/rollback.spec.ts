import { test } from '@japa/runner'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

const FAKE_SSH = `#!${process.execPath}
const { spawnSync } = require('node:child_process')
const { writeSync } = require('node:fs')
const command = Buffer.from(process.argv.at(-1).match(/echo ([A-Za-z0-9+/=]+)\\|/)[1], 'base64').toString()
if (process.env.ROLLBACK_FAIL_READ && command.includes('basename')) process.exit(255)
const result = spawnSync('bash', ['-c', command])
if (result.stdout.length) writeSync(1, result.stdout)
if (result.stderr.length) writeSync(2, result.stderr)
process.exit(result.status ?? 1)
`

// Runs a fixture against a local "server": the fake ssh executes commands with bash.
async function runFixture(fixture: string) {
  const directory = await mkdtemp(join(tmpdir(), 'cata-rollback-'))
  try {
    await writeFile(join(directory, 'ssh'), FAKE_SSH, { mode: 0o755 })
    return await execa(
      process.execPath,
      [fileURLToPath(new URL(`./fixtures/${fixture}`, import.meta.url)), directory],
      { reject: false, env: { PATH: `${directory}${delimiter}${process.env.PATH}` } }
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('rollback preserves state on read failure and consumes the previous reference', async ({
  assert,
}) => {
  const result = await runFixture('check_rollback.ts')
  assert.equal(result.exitCode, 0, result.stderr)
}).timeout(10_000)

test('rollback hooks validate the target before the switch and restart after it', async ({
  assert,
}) => {
  const result = await runFixture('check_rollback_hooks.ts')
  assert.equal(result.exitCode, 0, result.stderr)
}).timeout(10_000)
