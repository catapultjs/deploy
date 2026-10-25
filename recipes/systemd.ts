import { basename } from 'node:path'
import type {} from '../src/types.ts'
import { type TaskContext, task, desc, get, upload, onStatus } from '../index.ts'
import { ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'systemd:install': true
    'systemd:start': true
    'systemd:stop': true
    'systemd:enable': true
    'systemd:disable': true
    'systemd:daemon-reload': true
    'systemd:check': true
    'systemd:restart': true
    'systemd:reload': true
    'systemd:status': true
    'systemd:logs': true
  }
}

function sudo(): string {
  return get<boolean>('systemd_use_sudo', true) ? 'sudo ' : ''
}

function services(): string[] {
  const names = get<string[]>('systemd_services', [get<string>('systemd_service', 'app')])
  if (
    !Array.isArray(names) ||
    !names.length ||
    names.some((name) => typeof name !== 'string' || !name.trim() || name.startsWith('-'))
  ) {
    throw new Error('systemd_services must contain non-empty service names without leading dashes')
  }
  return [...new Set(names)]
}

function serviceArgs(): string {
  return services().map(q).join(' ')
}

function checkCommand(): string {
  // is-active with several units succeeds if ANY unit is active: check each separately.
  return services()
    .map((name) => `${sudo()}systemctl is-active --quiet ${q(name)}`)
    .join('\n')
}

onStatus(async (_ctx, host) => {
  const data: Record<string, string> = {}
  for (const name of services()) {
    const { stdout } = await ssh(host, `set +e\n${sudo()}systemctl is-active ${q(name)} || true`)
    data[`systemd:${name}`] = stdout.trim() || 'unavailable'
  }
  return data
})

for (const action of ['start', 'stop', 'enable', 'disable', 'daemon-reload'] as const) {
  desc(`Runs systemctl ${action}`)
  task(`systemd:${action}`, async ({ host, logger }: TaskContext) => {
    const args = action === 'daemon-reload' ? '' : ` ${serviceArgs()}`
    const { stdout } = await ssh(host, `set -e\n${sudo()}systemctl ${action}${args}`, {
      color: true,
    })
    logger.log(stdout.trim())
  })
}

desc('Checks that every configured systemd service is active')
task('systemd:check', async ({ host }: TaskContext) => {
  await ssh(host, `set -e\n${checkCommand()}`)
})

desc('Uploads, installs and enables local systemd unit files')
task('systemd:install', async ({ host, paths, logger }: TaskContext) => {
  const files = get<string[]>('systemd_unit_files', [])
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.some(
      (file) =>
        typeof file !== 'string' || !file.endsWith('.service') || basename(file).startsWith('-')
    )
  ) {
    throw new Error('systemd_unit_files must contain local .service paths')
  }
  const names = files.map((file) => basename(file))
  if (new Set(names).size !== names.length)
    throw new Error('systemd_unit_files contains duplicate unit names')
  const staging = `${paths.cataConfig}/systemd`
  await ssh(host, `set -e\nmkdir -p ${q(staging)}`)
  for (const file of files) await upload(file, `${staging}/${basename(file)}`)
  const commands = files.map(
    (file) =>
      `${sudo()}install -m 0644 ${q(`${staging}/${basename(file)}`)} ${q(`/etc/systemd/system/${basename(file)}`)}`
  )
  commands.push(
    `${sudo()}systemctl daemon-reload`,
    `${sudo()}systemctl enable ${names.map(q).join(' ')}`
  )
  const { stdout } = await ssh(host, ['set -e', ...commands].join('\n'), { color: true })
  logger.log(stdout.trim())
})

function logLines(): number {
  const lines = Number(get<number>('systemd_logs_lines', 100))
  return Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 100
}

desc('Restarts the configured systemd service')
task('systemd:restart', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(
    host,
    `set -e\n${sudo()}systemctl restart ${serviceArgs()}\n${checkCommand()}`,
    {
      color: true,
    }
  )
  logger.log(stdout.trim())
})

desc('Reloads the configured systemd service')
task('systemd:reload', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(host, `set -e\n${sudo()}systemctl reload ${serviceArgs()}`, {
    color: true,
  })
  logger.log(stdout.trim())
})

desc('Displays the configured systemd service status')
task('systemd:status', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(
    host,
    `set +e\n${sudo()}systemctl status ${serviceArgs()} --no-pager`,
    { color: true }
  )
  logger.log(stdout.trim())
})

desc('Displays journal logs for the configured systemd service')
task('systemd:logs', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(
    host,
    `set +e\n${sudo()}journalctl ${services()
      .map((name) => `-u ${q(name)}`)
      .join(' ')} -n ${q(String(logLines()))} --no-pager`,
    { color: true }
  )
  logger.log(stdout.trim())
})
