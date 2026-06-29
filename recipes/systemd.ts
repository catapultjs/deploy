import type {} from '../src/types.ts'
import { type TaskContext, task, desc, get } from '../index.ts'
import { ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'systemd:restart': true
    'systemd:reload': true
    'systemd:status': true
    'systemd:logs': true
  }
}

function sudo(): string {
  return get<boolean>('systemd_use_sudo', true) ? 'sudo ' : ''
}

function service(): string {
  return get<string>('systemd_service', 'app')
}

function logLines(): number {
  const lines = Number(get<number>('systemd_logs_lines', 100))
  return Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 100
}

desc('Restarts the configured systemd service')
task('systemd:restart', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(host, `set -e\n${sudo()}systemctl restart ${q(service())}`, {
    color: true,
  })
  logger.log(stdout.trim())
})

desc('Reloads the configured systemd service')
task('systemd:reload', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(host, `set -e\n${sudo()}systemctl reload ${q(service())}`, {
    color: true,
  })
  logger.log(stdout.trim())
})

desc('Displays the configured systemd service status')
task('systemd:status', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(
    host,
    `set +e\n${sudo()}systemctl status ${q(service())} --no-pager`,
    { color: true }
  )
  logger.log(stdout.trim())
})

desc('Displays journal logs for the configured systemd service')
task('systemd:logs', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(
    host,
    `set +e\n${sudo()}journalctl -u ${q(service())} -n ${q(String(logLines()))} --no-pager`,
    { color: true }
  )
  logger.log(stdout.trim())
})
