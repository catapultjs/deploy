import type {} from '../src/types.ts'
import { type TaskContext, task, desc, after, get, bin, upload, onStatus } from '../index.ts'
import { ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'caddy:validate': true
    'caddy:fmt': true
    'caddy:reload': true
    'caddy:config:show': true
    'caddy:config:upload': true
  }
}

function sudo(): string {
  return get<boolean>('caddy_use_sudo', true) ? 'sudo ' : ''
}

function configPath(): string {
  return get<string>('caddy_config_path', '/etc/caddy/Caddyfile')
}

function localConfigPath(): string {
  return get<string>('caddy_local_config_path', './Caddyfile')
}

function validateCommand(): string {
  return `${sudo()}${bin('caddy')} validate --config ${q(configPath())}`
}

function reloadCommand(): string {
  return `${sudo()}${bin('caddy')} reload --config ${q(configPath())}`
}

onStatus(async (_ctx, host) => {
  const { stdout } = await ssh(host, `set +e\n${bin('caddy')} version || true`)
  const version = stdout.trim().split(/\s+/)[0]
  return { caddy: version || 'unavailable' }
})

desc('Validates the Caddy configuration')
task('caddy:validate', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(host, `set -e\n${validateCommand()}`, { color: true })
  logger.log(stdout.trim())
})

desc('Formats the configured Caddyfile')
task('caddy:fmt', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(
    host,
    `set -e\n${sudo()}${bin('caddy')} fmt --overwrite ${q(configPath())}`,
    { color: true }
  )
  logger.log(stdout.trim())
})

desc('Reloads Caddy with the configured Caddyfile')
task('caddy:reload', async ({ host, logger }: TaskContext) => {
  const validateBeforeReload = get<boolean>('caddy_validate_before_reload', true)
  const commands = [
    'set -e',
    validateBeforeReload ? validateCommand() : '',
    reloadCommand(),
  ].filter(Boolean)

  const { stdout } = await ssh(host, commands.join('\n'), { color: true })
  logger.log(stdout.trim())
})

desc('Displays the configured Caddyfile')
task('caddy:config:show', async ({ host, logger }: TaskContext) => {
  const { stdout } = await ssh(host, `set -e\n${sudo()}cat ${q(configPath())}`, { color: true })
  logger.log(stdout.trim())
})

desc('Uploads and validates a local Caddyfile')
task('caddy:config:upload', async ({ host, paths, logger }: TaskContext) => {
  const remoteTmp = `${paths.cataConfig}/Caddyfile.upload`

  await ssh(host, `set -e\nmkdir -p ${q(paths.cataConfig)}`)
  await upload(localConfigPath(), remoteTmp)

  const { stdout } = await ssh(
    host,
    [
      'set -e',
      `${sudo()}install -m 0644 ${q(remoteTmp)} ${q(configPath())}`,
      validateCommand(),
    ].join('\n'),
    { color: true }
  )

  logger.log(stdout.trim())
})

if (get<boolean>('caddy_reload_after_publish', false)) {
  after('deploy:publish', 'caddy:reload')
}
