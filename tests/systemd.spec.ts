import { test } from '@japa/runner'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

async function runSystemd(
  store: Record<string, unknown> = {},
  tasks = ['systemd:restart'],
  failCheck = false
) {
  const directory = await mkdtemp(join(tmpdir(), 'cata-systemd-'))
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
appendFileSync(process.env.SYSTEMD_TEST_LOG, JSON.stringify(command) + '\\n')
if (typeof command === 'string' && command.includes('basename')) process.stdout.write('test\\n')
if (typeof command === 'string' && command.includes('ls -1dt')) process.stdout.write('test/\\nprevious/\\n')
if (process.env.SYSTEMD_TEST_FAIL === '1' && typeof command === 'string' && command.includes("is-active --quiet 'worker'")) process.exit(1)
`
    for (const name of ['ssh', 'scp']) {
      await writeFile(join(directory, name), script, { mode: 0o755 })
    }
    const result = await execa(
      process.execPath,
      [
        fileURLToPath(new URL('./fixtures/run_systemd.ts', import.meta.url)),
        JSON.stringify({ store, tasks }),
      ],
      {
        reject: false,
        env: {
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          SYSTEMD_TEST_LOG: log,
          SYSTEMD_TEST_FAIL: failCheck ? '1' : '0',
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

test.group('systemd recipe', () => {
  test('preserves single-service configuration and checks activity', async ({ assert }) => {
    const { result, commands } = await runSystemd({ systemd_service: 'web' })
    assert.equal(result.exitCode, 0, result.stderr)
    assert.include(commands[0], "sudo systemctl restart 'web'")
    assert.include(commands[0], "sudo systemctl is-active --quiet 'web'")
  })

  test('restarts and checks every service and selects every journal', async ({ assert }) => {
    const { result, commands } = await runSystemd(
      { systemd_services: ['web', 'worker'], systemd_use_sudo: false },
      ['systemd:restart', 'systemd:logs']
    )
    assert.equal(result.exitCode, 0, result.stderr)
    assert.include(
      commands[0],
      "systemctl restart 'web' 'worker'\nsystemctl is-active --quiet 'web'\nsystemctl is-active --quiet 'worker'"
    )
    assert.include(commands[1], "journalctl -u 'web' -u 'worker'")
    assert.notInclude(JSON.stringify(commands), 'sudo ')
  })

  test('fails restart if the worker is inactive', async ({ assert }) => {
    const { result, commands } = await runSystemd(
      { systemd_services: ['web', 'worker'] },
      ['systemd:restart', 'systemd:logs'],
      true
    )
    assert.notEqual(result.exitCode, 0)
    assert.lengthOf(commands, 1)
  })

  test('uploads all units before installing, reloading and enabling', async ({ assert }) => {
    const { result, commands } = await runSystemd(
      { systemd_unit_files: ['./deploy/web.service', './deploy/worker.service'] },
      ['systemd:install']
    )
    assert.equal(result.exitCode, 0, result.stderr)
    assert.equal(commands[1][1], './deploy/web.service')
    assert.equal(commands[2][1], './deploy/worker.service')
    assert.include(
      commands[3],
      "install -m 0644 '/srv/app/.catapult/systemd/worker.service' '/etc/systemd/system/worker.service'"
    )
    assert.include(
      commands[3],
      "sudo systemctl daemon-reload\nsudo systemctl enable 'web.service' 'worker.service'"
    )
    assert.notInclude(commands[3], 'systemctl start')
  })

  test('restarts services after switching rollback release and before healthcheck', async ({
    assert,
  }) => {
    const { result, commands } = await runSystemd({ systemd_services: ['web', 'worker'] }, [
      'rollback',
    ])
    assert.equal(result.exitCode, 0, result.stderr)
    assert.include(commands[0], "ln -sfn '/srv/app/releases/previous' '/srv/app/current'")
    assert.include(commands[1], "systemctl restart 'web' 'worker'")
    assert.include(commands[2], 'healthcheck-marker')
  })

  test('restarts services on automatic rollback after a failed healthcheck', async ({ assert }) => {
    const { result, commands } = await runSystemd({ systemd_services: ['web', 'worker'] }, [
      'auto-rollback',
    ])
    assert.equal(result.exitCode, 0, result.stderr)
    const rollback = commands.findIndex(
      (command) => typeof command === 'string' && command.includes('ln -sfn')
    )
    assert.isAbove(rollback, 0)
    assert.include(commands[rollback], "'/srv/app/releases/previous'")
    assert.include(commands[rollback + 1], "systemctl restart 'web' 'worker'")
    assert.include(commands[rollback + 2], 'healthcheck-marker')
  })

  test('does not restart systemd when it is absent from the deployment pipeline', async ({
    assert,
  }) => {
    const { result, commands } = await runSystemd({}, ['rollback-without-systemd'])
    assert.equal(result.exitCode, 0, result.stderr)
    assert.lengthOf(commands, 2)
    assert.notInclude(JSON.stringify(commands), 'systemctl')
  })
})
