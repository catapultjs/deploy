import type {} from '../src/types.ts'
import { task, cd, run, after, onSetup, bin } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'adonisjs:shared': true
    'adonisjs:build': true
    'adonisjs:migrate': true
  }
}
import { ssh, q, getPaths } from '../src/utils.ts'

task('adonisjs:shared', () => {
  run('rm -rf {{release_path}}/storage {{release_path}}/logs {{release_path}}/tmp')
  run('rm -f {{release_path}}/.env')
  run('ln -sfn {{shared_path}}/storage {{release_path}}/storage')
  run('ln -sfn {{shared_path}}/logs {{release_path}}/logs')
  run('ln -sfn {{shared_path}}/tmp {{release_path}}/tmp')
  run('ln -sfn {{shared_path}}/.env {{release_path}}/.env')
})

task('adonisjs:build', () => {
  cd('{{release_path}}')
  run(`${bin('npm')} ci`)
  run(`${bin('node')} ace build`)
  run(
    `if [ -f package-lock.tson ]; then ${bin('npm')} ci --omit=dev; else ${bin('npm')} install --omit=dev; fi`
  )
})

task('adonisjs:migrate', () => {
  cd('{{release_path}}')
  run(`${bin('node')} ace migration:run`)
})

after('deploy:upload', 'adonisjs:shared')
after('adonisjs:shared', 'adonisjs:build')
after('adonisjs:build', 'adonisjs:migrate')

onSetup(async (ctx, host) => {
  const paths = getPaths(host.deployPath, ctx.release)
  await ssh(
    host,
    `
    set -e
    mkdir -p ${q(paths.shared + '/storage')}
    mkdir -p ${q(paths.shared + '/logs')}
    mkdir -p ${q(paths.shared + '/tmp')}

    if [ ! -f ${q(paths.shared + '/.env')} ]; then
      touch ${q(paths.shared + '/.env')}
    fi
  `
  )
})
