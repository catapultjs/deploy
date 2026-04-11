import type {} from '../src/types.ts'
import { createRequire } from 'module'
import { type TaskContext, task, desc, cd, run, after, onStatus, bin } from '../index.ts'
import { getPaths, ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'pm2:ecosystem': true
    'pm2:start': true
    'pm2:save': true
    'pm2:stop': true
    'pm2:reload': true
    'pm2:restart': true
    'pm2:delete': true
    'pm2:logs': true
    'pm2:list': true
    'pm2:show': true
  }
}

onStatus(async (_ctx, host, logger) => {
  const { stdout } = await ssh(host, `set +e\n${bin('pm2')} --version || true`)
  logger.log(stdout.trim() ? `pm2 ${stdout.trim()}` : 'pm2 unavailable')
})

desc('Symlinks ecosystem.config.cjs from the release into the base path')
task('pm2:ecosystem', () => {
  run('ln -sfn {{release_path}}/ecosystem.config.cjs {{base_path}}/ecosystem.config.cjs')
})

desc('Starts or reloads PM2 processes with updated environment')
task('pm2:start', () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} startOrReload ecosystem.config.cjs --update-env`)
})

desc('Persists the PM2 process list')
task('pm2:save', () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} save`)
})

desc('Stops all PM2 processes')
task('pm2:stop', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} stop ecosystem.config.cjs --update-env`)
})

desc('Zero-downtime reload of PM2 processes')
task('pm2:reload', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} reload ecosystem.config.cjs --update-env`)
})

desc('Hard restart of PM2 processes')
task('pm2:restart', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} restart ecosystem.config.cjs --update-env`)
})

desc('Deletes all PM2 processes')
task('pm2:delete', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} delete ecosystem.config.cjs --update-env`)
})

desc('Displays the last 50 lines of logs for all apps')
task('pm2:logs', async ({ host, deployCtx, logger }: TaskContext) => {
  const { base } = getPaths(host.deployPath, deployCtx.release)
  const require = createRequire(import.meta.url)
  const ecosystem = require(process.cwd() + '/ecosystem.config.cjs')
  const names = (ecosystem?.apps ?? []).map((a: { name: string }) => a.name).join(' ')
  const { stdout } = await ssh(
    host,
    `set -e\ncd ${q(base)}\n${bin('pm2')} logs ${names} --nostream --lines 50`,
    { color: true }
  )
  logger.log(stdout.trim())
})

desc('Lists all PM2 processes')
task('pm2:list', async ({ host, deployCtx, logger }: TaskContext) => {
  const { base } = getPaths(host.deployPath, deployCtx.release)
  const { stdout } = await ssh(host, `set -e\ncd ${q(base)}\n${bin('pm2')} list`, {
    color: true,
  })
  logger.log(stdout.trim())
})

desc('Shows detailed info for each app in ecosystem.config.cjs')
task('pm2:show', async ({ host, deployCtx, logger }: TaskContext) => {
  const { base } = getPaths(host.deployPath, deployCtx.release)
  const require = createRequire(import.meta.url)
  const ecosystem = require(process.cwd() + '/ecosystem.config.cjs')
  const names = (ecosystem?.apps ?? []).map((a: { name: string }) => a.name)
  for (const name of names) {
    const { stdout } = await ssh(host, `set -e\ncd ${q(base)}\n${bin('pm2')} show ${q(name)}`, {
      color: true,
    })
    logger.log(stdout.trim())
  }
})

after('deploy:publish', 'pm2:ecosystem')
after('pm2:ecosystem', 'pm2:start')
after('pm2:start', 'pm2:save')
