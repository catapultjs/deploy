import type {} from '../src/types.ts'
import {
  task,
  desc,
  cd,
  run,
  local,
  after,
  before,
  bin,
  get,
  set,
  onConfig,
  pmInstall,
  pmInstallProd,
} from '../index.ts'
import { getLockFileName } from '../src/utils.ts'
import { Strategy } from '../src/enums.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'adonisjs:builder:install': true
    'adonisjs:builder:build': true
    'adonisjs:builder:test': true
    'adonisjs:install': true
    'adonisjs:build': true
    'adonisjs:test': true
    'adonisjs:shared': true
    'adonisjs:migrate': true
  }
}

set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_dirs', ['storage', 'logs'])
set('shared_files', ['.env'])
set('adonisjs_path', '')
set('build_output', 'build')

desc('Installs dependencies in the builder')
task('adonisjs:builder:install', () => {
  const adonisjsPath = get<string>('adonisjs_path')
  cd(`{{builder_path}}/${adonisjsPath}`)
  run(pmInstall())
})

desc('Installs production-only dependencies in the release')
task('adonisjs:install', () => {
  const adonisjsPath = get<string>('adonisjs_path')
  cd(`{{release_path}}/${adonisjsPath}`)
  run(pmInstallProd())
})

desc('Builds the AdonisJS application in the builder')
task('adonisjs:builder:build', async () => {
  const adonisjsPath = get<string>('adonisjs_path')
  const buildOutput = get<string>('build_output')
  const lockFile = await getLockFileName(adonisjsPath)
  cd(`{{builder_path}}/${adonisjsPath}`)
  run(`${bin('node')} ace build`)
  run(`cp package.json ./${buildOutput}`)
  run(`cp ${lockFile} ./${buildOutput}`)
  run(`mkdir ./${buildOutput}/tmp`)
})

desc('Builds the AdonisJS application locally')
task('adonisjs:build', async () => {
  const adonisjsPath = get<string>('adonisjs_path')
  const buildOutput = get<string>('build_output')
  const lockFile = await getLockFileName(adonisjsPath)
  await local('node ace build', { cwd: adonisjsPath })
  await local(`cp package.json ./${buildOutput}`, { cwd: adonisjsPath })
  await local(`cp ${lockFile} ./${buildOutput}`, { cwd: adonisjsPath })
  await local(`mkdir ./${buildOutput}/tmp`, { cwd: adonisjsPath })
})

desc('Runs tests in the builder')
task('adonisjs:builder:test', () => {
  const adonisjsPath = get<string>('adonisjs_path')
  cd(`{{builder_path}}/${adonisjsPath}`)
  run(`${bin('node')} ace test`)
})

desc('Runs tests locally')
task('adonisjs:test', async () => {
  const adonisjsPath = get<string>('adonisjs_path')
  await local('node ace test', { cwd: adonisjsPath })
})

desc('Symlinks shared dirs/files into the build output directory within the release')
task('adonisjs:shared', () => {
  const adonisjsPath = get<string>('adonisjs_path')
  const buildOutput = get<string>('build_output')
  const dirs: string[] = get('shared_dirs', [])
  const files: string[] = get('shared_files', [])

  for (const dir of dirs) {
    const d = dir.replace(/^\//, '')
    run(`rm -rf {{release_path}}/${adonisjsPath}/${buildOutput}/${d}`)
    run(`ln -sfn {{shared_path}}/${d} {{release_path}}/${adonisjsPath}/${buildOutput}/${d}`)
  }

  for (const file of files) {
    const f = file.replace(/^\//, '')
    run(`rm -f {{release_path}}/${adonisjsPath}/${buildOutput}/${f}`)
    run(`ln -sfn {{shared_path}}/${f} {{release_path}}/${adonisjsPath}/${buildOutput}/${f}`)
  }
})

desc('Runs database migrations')
task('adonisjs:migrate', () => {
  const adonisjsPath = get<string>('adonisjs_path')
  cd(`{{release_path}}/${adonisjsPath}`)
  run(`${bin('node')} ace migration:run --force`)
})

onConfig((config) => {
  if (config.strategy === Strategy.REMOTE) {
    after('deploy:update_code', 'adonisjs:builder:install')
    after('deploy:builder:shared', 'adonisjs:builder:test')
    after('adonisjs:builder:test', 'adonisjs:builder:build')
    after('deploy:builder:release', 'adonisjs:install')
  } else {
    before('deploy:release', 'adonisjs:build')
    before('adonisjs:build', 'adonisjs:test')
    after('deploy:shared', 'adonisjs:install')
  }

  before('deploy:publish', 'adonisjs:migrate')
})
