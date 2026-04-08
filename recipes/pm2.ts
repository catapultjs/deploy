import type {} from '../src/types.ts'
import { createRequire } from 'module'
import { type TaskContext, task, cd, run, after, onStatus, bin } from '../index.ts'
import { getPaths, ssh, q } from '../src/utils.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'pm2:ecosystem': true
    'pm2:start': true
    'pm2:save': true
    'pm2:stop': true
    'pm2:reload': true
    'pm2:restart': true
    'pm2:logs': true
    'pm2:list': true
    'pm2:show': true
  }
}

onStatus(async (_ctx, host, logger) => {
  const { stdout } = await ssh(host, `set +e\n${bin('pm2')} --version || true`)
  logger.log(stdout.trim() ? `pm2 ${stdout.trim()}` : 'pm2 unavailable')
})

task('pm2:ecosystem', () => {
  run('ln -sfn {{release_path}}/ecosystem.config.cjs {{base_path}}/ecosystem.config.cjs')
})

task('pm2:start', () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} startOrReload ecosystem.config.cjs --update-env`)
})

task('pm2:save', () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} save`)
})

task('pm2:stop', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} stop ecosystem.config.cjs --update-env`)
})

task('pm2:reload', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} reload ecosystem.config.cjs --update-env`)
})

task('pm2:restart', async () => {
  cd('{{base_path}}')
  run(`${bin('pm2')} restart ecosystem.config.cjs --update-env`)
})

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

task('pm2:list', async ({ host, deployCtx, logger }: TaskContext) => {
  const { base } = getPaths(host.deployPath, deployCtx.release)
  const { stdout } = await ssh(host, `set -e\ncd ${q(base)}\n${bin('pm2')} list`, {
    color: true,
  })
  logger.log(stdout.trim())
})

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
