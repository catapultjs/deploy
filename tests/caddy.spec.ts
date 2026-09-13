import { test } from '@japa/runner'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

async function runCaddy(
  store: Record<string, unknown> = {},
  tasks = ['caddy:config:upload', 'caddy:reload'],
  failValidation = false
) {
  const directory = await mkdtemp(join(tmpdir(), 'cata-caddy-'))
  const log = join(directory, 'commands.jsonl')
  try {
    // Capture transport commands without opening a connection or changing a server.
    const script = `#!${process.execPath}
const { appendFileSync } = require('node:fs')
const { basename } = require('node:path')
const args = process.argv.slice(2)
const command = basename(process.argv[1]) === 'ssh'
  ? Buffer.from(args.at(-1).match(/echo ([A-Za-z0-9+/=]+)\\|/)[1], 'base64').toString()
  : args
appendFileSync(process.env.CADDY_TEST_LOG, JSON.stringify(command) + '\\n')
if (process.env.CADDY_TEST_FAIL === '1' && typeof command === 'string' && command.includes(' validate ')) process.exit(1)
`
    for (const name of ['ssh', 'scp']) {
      await writeFile(join(directory, name), script, { mode: 0o755 })
    }
    const result = await execa(
      process.execPath,
      [
        fileURLToPath(new URL('./fixtures/run_caddy.ts', import.meta.url)),
        JSON.stringify({ store, tasks }),
      ],
      {
        reject: false,
        env: {
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          CADDY_TEST_LOG: log,
          CADDY_TEST_FAIL: failValidation ? '1' : '0',
        },
      }
    )
    const contents = await readFile(log, 'utf8')
    const commands = contents
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    return { result, commands }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test.group('Caddy recipe', () => {
  test('keeps uploading and reloading the default Caddyfile', async ({ assert }) => {
    const { result, commands } = await runCaddy()
    assert.equal(result.exitCode, 0, result.stderr)
    assert.deepEqual(commands[1], [
      '-r',
      './Caddyfile',
      'deploy@example.test:/srv/app/.catapult/Caddyfile.upload',
    ])
    assert.include(
      commands[2],
      "sudo install -m 0644 '/srv/app/.catapult/Caddyfile.upload' '/etc/caddy/Caddyfile'"
    )
    assert.include(commands[2], "sudo caddy validate --config '/etc/caddy/Caddyfile'")
    assert.include(commands[3], "sudo caddy reload --config '/etc/caddy/Caddyfile'")
  })

  test('defaults the upload destination to a custom main config path', async ({ assert }) => {
    const { result, commands } = await runCaddy({ caddy_config_path: '/opt/caddy/Caddyfile' })
    assert.equal(result.exitCode, 0, result.stderr)
    assert.include(
      commands[2],
      "sudo install -m 0644 '/srv/app/.catapult/Caddyfile.upload' '/opt/caddy/Caddyfile'"
    )
    assert.include(commands[3], "sudo caddy reload --config '/opt/caddy/Caddyfile'")
  })

  test('uploads a site file while all other tasks target the main config', async ({ assert }) => {
    const { result, commands } = await runCaddy(
      {
        caddy_upload_path: '/etc/caddy/site files/example.caddy',
        caddy_local_config_path: './deploy/site.caddy',
        caddy_use_sudo: false,
      },
      ['caddy:config:upload', 'caddy:validate', 'caddy:reload', 'caddy:fmt', 'caddy:config:show']
    )
    assert.equal(result.exitCode, 0, result.stderr)
    assert.equal(commands[1][1], './deploy/site.caddy')
    assert.include(
      commands[2],
      "mkdir -p '/etc/caddy/site files'\ninstall -m 0644 '/srv/app/.catapult/Caddyfile.upload' '/etc/caddy/site files/example.caddy'\ncaddy validate --config '/etc/caddy/Caddyfile'"
    )
    assert.include(commands[3], "caddy validate --config '/etc/caddy/Caddyfile'")
    assert.include(commands[4], "caddy reload --config '/etc/caddy/Caddyfile'")
    assert.include(commands[5], "caddy fmt --overwrite '/etc/caddy/Caddyfile'")
    assert.include(commands[6], "cat '/etc/caddy/Caddyfile'")
    assert.notInclude(JSON.stringify(commands), 'sudo ')
  })

  test('fails the upload task and stops before reload when validation fails', async ({
    assert,
  }) => {
    const { result, commands } = await runCaddy(
      { caddy_upload_path: '/etc/caddy/sites/example.caddy' },
      undefined,
      true
    )
    assert.notEqual(result.exitCode, 0)
    assert.lengthOf(commands, 3)
    assert.notInclude(JSON.stringify(commands), 'caddy reload')
  })
})
