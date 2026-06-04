/**
 * TYPE: local-build
 * DESCRIPTION:
 * This recipe builds an AdonisJS application locally, uploads the build output,
 * then installs production dependencies on the server.
 */
import './adonisjs.ts'
import {
  type TaskContext,
  task,
  desc,
  get,
  local,
  upload,
  pmInstallProd,
  cd,
  run,
  before,
  after,
} from '../index.ts'
import { getPackageLockFileName } from '../src/utils.ts'

desc('Builds the AdonisJS application locally')
task('deploy:build', async () => {
  const adonisjsPath = get<string>('adonisjs_path', '')
  const cwd = adonisjsPath || process.cwd()

  await local('node ace build', { cwd })

  const lockFile = await getPackageLockFileName(cwd)
  await local('cp package.json ./build', { cwd })

  if (lockFile) {
    await local(`cp ${lockFile} ./build`, { cwd })
  }

  await local('if [ -f pnpm-workspace.yaml ]; then cp pnpm-workspace.yaml ./build; fi', { cwd })
  await local('if [ -f .npmrc ]; then cp .npmrc ./build; fi', { cwd })
  await local('if [ -f ecosystem.config.cjs ]; then cp ecosystem.config.cjs ./build; fi', { cwd })
  await local('mkdir -p ./build/tmp', { cwd })
})

desc('Uploads local build artifacts to the release directory')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  const adonisjsPath = get<string>('adonisjs_path', '').replace(/\/?$/, '')
  const configuredSource = get(
    'source_path',
    adonisjsPath ? `${adonisjsPath}/build/.` : './build/.'
  )
  const source = configuredSource.endsWith('/.')
    ? configuredSource
    : `${configuredSource.replace(/\/+$/, '')}/.`
  await upload(source, paths.release)
})

desc('Installs production dependencies in the release')
task('deploy:install', () => {
  cd('{{release_path}}')
  run(pmInstallProd())
})

before('deploy:lock', 'deploy:build')
after('deploy:shared', 'deploy:install')
