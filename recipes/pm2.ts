import { createRequire } from 'module'
import type {} from '../src/types.ts'
import { task, after, onStatus, bin, getContext, getPaths, ssh, q } from '../index.ts'

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

task('pm2:start', async () => {
  const { host, deployCtx } = getContext()
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

task('pm2:save', async () => {
  const { host } = getContext()
  await ssh(host, `set -e\n${bin('pm2')} save`)
  console.log(`✅ [${host.name}] pm2 saved`)
})

after('deploy:publish', 'pm2:start')
after('pm2:start', 'pm2:save')

task('pm2:logs', async () => {
  const { host, deployCtx } = getContext()
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

task('pm2:list', async () => {
  const { host, deployCtx } = getContext()
  const paths = getPaths(host.deployPath, deployCtx.release)
  const { stdout } = await ssh(host, `set -e\ncd ${q(paths.current)}\n${bin('pm2')} list`)
  console.log(stdout.trim())
})

task('pm2:stop', async () => {
  const { host, deployCtx } = getContext()
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(host, `set -e\ncd ${q(paths.current)}\n${bin('pm2')} stop ecosystem.config.cjs`)
  console.log(`✅ [${host.name}] pm2 stopped`)
})

task('pm2:reload', async () => {
  const { host, deployCtx } = getContext()
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(
    host,
    `set -e\ncd ${q(paths.current)}\n${bin('pm2')} reload ecosystem.config.cjs --update-env`
  )
  console.log(`✅ [${host.name}] pm2 reloaded`)
})

task('pm2:restart', async () => {
  const { host, deployCtx } = getContext()
  const paths = getPaths(host.deployPath, deployCtx.release)
  await ssh(
    host,
    `set -e\ncd ${q(paths.current)}\n${bin('pm2')} restart ecosystem.config.cjs --update-env`
  )
  console.log(`✅ [${host.name}] pm2 restarted`)
})
