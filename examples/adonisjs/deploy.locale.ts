import {
  type TaskContext,
  defineConfig,
  upload,
  desc,
  task,
  get,
  set,
  local,
  cd,
  run,
  pmInstallProd,
  before,
  after,
} from '@catapultjs/deploy'
import { Verbose } from '@catapultjs/deploy/enums'
import '@catapultjs/deploy/recipes/pm2'

set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_dirs', ['storage', 'logs'])
set('shared_files', ['.env'])
set('adonisjs_path', './')

desc('Builds the AdonisJS application locally')
task('deploy:build', async () => {
  const adonisjsPath = get<string>('adonisjs_path', '')
  await local('node ace build', { cwd: adonisjsPath })
  await local('cp package.json ./build', { cwd: adonisjsPath })
  await local('cp package-lock.json ./build', { cwd: adonisjsPath })
  await local('mkdir ./build/tmp', { cwd: adonisjsPath })
})

desc('Uploads local artifacts to the release directory')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  const source = get('source_path', './build/.').replace(/\/?$/, '/')
  await upload(source, paths.release)
})

desc('Installs dependencies in the release')
task('deploy:install', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

before('deploy:lock', 'deploy:build')
after('deploy:shared', 'deploy:install')

export default defineConfig({
  verbose: Verbose.TRACE,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@192.168.122.148',
      deployPath: '/home/deploy/deploy-test',
    },
  ],
})
