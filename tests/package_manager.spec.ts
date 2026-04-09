import { test } from '@japa/runner'
import { Context } from '../src/context.ts'
import { pm, pmInstall, pmInstallProd } from '../src/package_manager.ts'
import type { Config } from '../src/types.ts'

function setManager(packageManager: Config['packageManager']) {
  Context.set({
    config: { keepReleases: 5, hosts: [], packageManager },
    release: '2024-01-01',
    hooks: {},
  })
}

test.group('package_manager', (group) => {
  group.each.teardown(() => setManager('npm'))

  test('pm() returns npm by default', ({ assert }) => {
    setManager(undefined)
    assert.equal(pm(), 'npm')
  })

  test('pm() returns pnpm when set', ({ assert }) => {
    setManager('pnpm')
    assert.equal(pm(), 'pnpm')
  })

  test('pm() returns yarn when set', ({ assert }) => {
    setManager('yarn')
    assert.equal(pm(), 'yarn')
  })

  test('pmInstall() returns npm ci for npm', ({ assert }) => {
    setManager('npm')
    assert.equal(pmInstall(), 'npm ci')
  })

  test('pmInstall() returns frozen lockfile command for pnpm', ({ assert }) => {
    setManager('pnpm')
    assert.equal(pmInstall(), 'pnpm install --frozen-lockfile')
  })

  test('pmInstall() returns frozen lockfile command for yarn', ({ assert }) => {
    setManager('yarn')
    assert.equal(pmInstall(), 'yarn install --frozen-lockfile')
  })

  test('pmInstallProd() returns npm install --omit=dev for npm', ({ assert }) => {
    setManager('npm')
    assert.equal(pmInstallProd(), 'npm install --omit=dev')
  })

  test('pmInstallProd() returns pnpm install --prod for pnpm', ({ assert }) => {
    setManager('pnpm')
    assert.equal(pmInstallProd(), 'pnpm install --prod')
  })

  test('pmInstallProd() returns yarn install --production for yarn', ({ assert }) => {
    setManager('yarn')
    assert.equal(pmInstallProd(), 'yarn install --production')
  })
})
