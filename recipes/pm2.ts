import type {} from '../src/types.ts'
import { createRequire } from 'module'
import { type TaskContext, task, after, onStatus, bin, getPaths, ssh, q } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'pm2:start': true
    'pm2:save': true
    'pm2:reload': true
    'pm2:logs': true
    'pm2:list': true
    'pm2:stop': true
    'pm2:restart': true
  }
}

onStatus(async (_ctx, host) => {
  const { stdout } = await ssh(host, `set +e\n${bin('pm2')} --version || true`)
  console.log(stdout.trim() ? `pm2 ${stdout.trim()}` : 'pm2 unavailable')
})

task('pm2:start', async ({ host, deployCtx }: TaskContext) => {
  const paths = getPaths(host.deployPath, deployCtx.release)

  await ssh(
    host,
    `
    set -e
    cd ${q(paths.current)}
    ${bin('pm2')} startOrReload ecosystem.config.cjs --update-env
  `
  )
  console.log(`✅ [${host.name}] pm2 started`)
})

task('pm2:save', async ({ host }: TaskContext) => {
  await ssh(host, `set -e\n${bin('pm2')} save`)
  console.log(`✅ [${host.name}] pm2 saved`)
})

task('pm2:logs', async ({ host, deployCtx }: TaskContext) => {
  const paths = getPaths(host.deployPath, deployCtx.release)
  const require = createRequire(import.meta.url)
  const ecosystem = require(process.cwd() + '/ecosystem.config.cjs')
  const names = (ecosystem?.apps ?? []).map((a: { name: string }) => a.name).join(' ')
  const { stdout } = await ssh(
    host,
    `set -e\ncd ${q(paths.current)}\n${bin('pm2')} logs ${names} --nostream --lines 50`
  )
  console.log(stdout.trim())
})

task('pm2:list', async ({ host, deployCtx }: TaskContext) => {
  const paths = getPaths(host.deployPath, deployCtx.release)
  const { stdout } = await ssh(host, `set -e\ncd ${q(paths.current)}\n${bin('pm2')} list`)
  console.log(stdout.trim())
})

task('pm2:stop', async ({ host, deployCtx }: TaskContext) => {
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(host, `set -e\ncd ${q(paths.current)}\n${bin('pm2')} stop ecosystem.config.cjs`)
  console.log(`✅ [${host.name}] pm2 stopped`)
})

task('pm2:reload', async ({ host, deployCtx }: TaskContext) => {
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(
    host,
    `set -e\ncd ${q(paths.current)}\n${bin('pm2')} reload ecosystem.config.cjs --update-env`
  )
  console.log(`✅ [${host.name}] pm2 reloaded`)
})

task('pm2:restart', async ({ host, deployCtx }: TaskContext) => {
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(
    host,
    `set -e\ncd ${q(paths.current)}\n${bin('pm2')} restart ecosystem.config.cjs --update-env`
  )
  console.log(`✅ [${host.name}] pm2 restarted`)
})

after('deploy:publish', 'pm2:start')
after('pm2:start', 'pm2:save')
