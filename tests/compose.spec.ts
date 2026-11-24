import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type OciEnv, R1, R2, calls, composeCalls, scenario } from './helpers/oci_harness.ts'

const STACK = {
  services: {
    web: { build: { context: '.' } },
    worker: { image: 'app:latest' },
    db: { image: 'postgres:16' },
  },
}

const COMPOSE = { recipe: 'compose', deploy: true, files: { 'compose.yml': 'services: {}\n' } }

/** A previous release R1, current and restorable: files, override, manifest and image. */
async function previousRelease(env: OciEnv, files = ['compose.yml']) {
  const release = env.releasePath('web', R1)
  for (const file of [...files, 'compose.catapult.yml']) {
    await mkdir(dirname(join(release, file)), { recursive: true })
    await writeFile(join(release, file), 'services: {}\n')
  }
  await writeFile(
    join(release, 'release.json'),
    JSON.stringify({
      schemaVersion: 1,
      images: [{ ref: `localhost/app:${R1}`, localId: 'sha256:old', remoteId: 'sha256:old' }],
      compose: { files, profiles: [], imageServices: ['web'] },
    })
  )
  await symlink(release, join(env.deployPath('web'), 'current'))
}

const withPrevious = {
  release: R2,
  remotes: [{ name: 'web', images: { [`localhost/app:${R1}`]: 'sha256:old' } }],
  setup: previousRelease,
}

async function current(env: OciEnv) {
  const link = join(env.deployPath('web'), 'current')
  return existsSync(link) ? readlink(link) : null
}

test.group('compose — deploy', () => {
  test('deploys the stack with a pinned release image', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: STACK,
        files: { 'compose.yml': 'services: {}\n', 'docker/nginx.conf': 'server {}\n' },
        store: {
          compose_upload: ['docker/nginx.conf'],
          compose_migrate: { service: 'web', command: ['node', 'ace', 'migration:run', '--force'] },
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const release = run.env.releasePath('web', R1)

        const override = await readFile(join(release, 'compose.catapult.yml'), 'utf8')
        assert.include(override, `"web":\n    image: "localhost/app:${R1}"\n    pull_policy: never`)
        assert.include(override, `"worker":\n    image: "localhost/app:${R1}"`)
        assert.notInclude(override, '"db"')
        assert.isTrue(existsSync(join(release, 'docker/nginx.conf')))

        const sequence = composeCalls(run, 'web').map((call) => call.args.slice(1).join(' '))
        assert.deepEqual(sequence, [
          'version',
          'config --services',
          'config --format json',
          'config',
          'config --services',
          'pull db',
          'run --rm -T web node ace migration:run --force',
          'up -d --no-build',
          'config --services',
        ])
        const [up] = composeCalls(run, 'web', 'up')
        assert.deepEqual(up.compose, {
          project: 'app',
          files: ['compose.yml', 'compose.catapult.yml'],
          profiles: [],
        })
        assert.equal(up.cwd, release)
        assert.deepEqual(composeCalls(run, 'web', 'config')[1].compose?.files, ['compose.yml'])

        assert.lengthOf(calls(run, 'remote-deploy@web', 'load'), 1)
        assert.equal(await current(run.env), release)
        assert.containSubset(await run.manifest(), {
          recipe: 'compose',
          compose: { files: ['compose.yml'], profiles: [], imageServices: ['web', 'worker'] },
        })
        assert.include(run.stdout, 'container(s) ready')
      }
    )
  }).timeout(60_000)

  test('passes files, profiles, targeted services and orphan removal', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: { services: { web: { image: 'app' }, db: { image: 'postgres:16' } } },
        files: { 'deploy/compose.yml': 'services: {}\n', 'deploy/compose.prod.yml': 'x\n' },
        store: {
          compose_files: ['deploy/compose.yml', 'deploy/compose.prod.yml'],
          compose_profiles: ['web'],
          compose_services: ['web'],
          compose_remove_orphans: true,
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const [up] = composeCalls(run, 'web', 'up')
        assert.deepEqual(up.args, ['compose', 'up', '-d', '--no-build', '--remove-orphans', 'web'])
        assert.deepEqual(up.compose, {
          project: 'app',
          files: ['deploy/compose.yml', 'deploy/compose.prod.yml', 'compose.catapult.yml'],
          profiles: ['web'],
        })
        assert.lengthOf(composeCalls(run, 'web', 'pull'), 0)
        assert.isTrue(existsSync(join(run.env.releasePath('web', R1), 'deploy/compose.prod.yml')))
      }
    )
  }).timeout(60_000)

  test('uses compose_image_services when set and rejects unknown services', async ({ assert }) => {
    await scenario(
      { ...COMPOSE, compose: STACK, store: { compose_image_services: ['worker'] } },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const override = await readFile(
          join(run.env.releasePath('web', R1), 'compose.catapult.yml'),
          'utf8'
        )
        assert.include(override, '"worker"')
        assert.notInclude(override, '"web"')
        assert.isFalse(
          composeCalls(run, 'web', 'config').some((call) => call.args.includes('--format'))
        )
      }
    )
    await scenario(
      { ...COMPOSE, compose: STACK, store: { compose_image_services: ['api'] } },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'compose_image_services lists unknown services: api')
      }
    )
  }).timeout(60_000)

  test('waits for containers that are starting', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: { services: { web: { build: {} } } },
        statuses: {
          web: 'created|Created;running|Up 1 second (health: starting);running|Up 3 seconds (healthy)',
        },
      },
      (run) => assert.equal(run.exitCode, 0, run.stderr)
    )
  }).timeout(60_000)
})

test.group('compose — release state', () => {
  test('ignores containers of services removed from the stack', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: { services: { web: { build: {} } } },
        remotes: [{ name: 'web', containers: { 'app-legacy-1': { service: 'legacy' } } }],
        statuses: { legacy: 'exited|Exited (1) 2 days ago' },
      },
      (run) => assert.equal(run.exitCode, 0, run.stderr)
    )
  }).timeout(60_000)

  test('rolls back with the Compose files recorded by the target release', async ({ assert }) => {
    await scenario(
      {
        recipe: 'compose',
        tasks: [],
        files: { 'compose.yml': 'services: {}\n' },
        compose: { services: { web: { build: {} } } },
        rollback: { host: 'web', target: R1 },
        remotes: withPrevious.remotes,
        setup: async (env) => {
          await previousRelease(env, ['deploy/compose.yml'])
          const newer = env.releasePath('web', R2)
          await mkdir(newer, { recursive: true })
          const link = join(env.deployPath('web'), 'current')
          await rm(link)
          await symlink(newer, link)
        },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const [up] = composeCalls(run, 'web', 'up')
        assert.deepEqual(up.compose?.files, ['deploy/compose.yml', 'compose.catapult.yml'])
      }
    )
  }).timeout(60_000)
})

test.group('compose — failures', () => {
  test('a failed migration blocks publication', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: STACK,
        store: { compose_migrate: { service: 'web', command: ['false'] } },
        env: { OCI_FAIL: 'remote-deploy@web:compose-run' },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'compose-run failed')
        assert.lengthOf(composeCalls(run, 'web', 'up'), 0)
        assert.isNull(await current(run.env))
      }
    )
  }).timeout(60_000)

  test('detects a container crashing right after start', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: { services: { web: { build: {} } } },
        statuses: { web: 'running|Up 1 second;exited|Exited (1) 1 second ago' },
      },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'containers failed: app-web-1 (Exited (1) 1 second ago)')
      }
    )
  }).timeout(60_000)

  test('fails when containers are not ready in time', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        compose: { services: { web: { build: {} } } },
        store: { compose_wait_timeout: 1 },
        statuses: { web: 'running|Up 1 second (health: starting)' },
      },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'containers not ready after 1s: app-web-1')
      }
    )
  }).timeout(60_000)

  test('rolls back to the previous release when the new one is unhealthy', async ({ assert }) => {
    await scenario(
      {
        ...COMPOSE,
        ...withPrevious,
        compose: { services: { web: { build: {} } } },
        statuses: { [`web@${R2}`]: 'running|Up 2 seconds (unhealthy)' },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stdout, 'auto rollback OK')
        const ups = composeCalls(run, 'web', 'up').map((call) => call.cwd)
        assert.deepEqual(ups, [run.env.releasePath('web', R2), run.env.releasePath('web', R1)])
        assert.equal(await current(run.env), run.env.releasePath('web', R1))
      }
    )
  }).timeout(60_000)

  test('validates upload paths', async ({ assert }) => {
    await scenario({ ...COMPOSE, store: { compose_upload: ['../secrets'] } }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'compose_upload must contain paths relative to the project')
    })
    await scenario({ ...COMPOSE, store: { compose_upload: ['missing.conf'] } }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'missing.conf does not exist locally')
    })
  }).timeout(60_000)
})

test.group('compose — provider and rollback', () => {
  test('warns about the Podman socket and restart service', async ({ assert }) => {
    await scenario(
      {
        recipe: 'compose',
        tasks: ['oci:check', 'compose:check'],
        env: { FAKE_SOCKET: 'inactive', FAKE_RESTART: 'disabled' },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.include(run.stdout, 'podman.socket is not active')
        assert.include(run.stdout, 'podman-restart.service is not enabled')
      }
    )
    await scenario(
      {
        recipe: 'compose',
        tasks: ['oci:check', 'compose:check'],
        remotes: [{ name: 'web', engines: ['docker'] }],
        env: { FAKE_SOCKET: 'inactive', FAKE_RESTART: 'disabled' },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.notInclude(run.stdout, 'podman')
      }
    )
  }).timeout(60_000)

  test('fails without a compose provider', async ({ assert }) => {
    await scenario(
      {
        recipe: 'compose',
        tasks: ['oci:check', 'compose:check'],
        env: { OCI_COMPOSE_MISSING: '1' },
      },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'podman compose found no provider')
      }
    )
  }).timeout(60_000)

  test('restarts the target release on manual rollback', async ({ assert }) => {
    await scenario(
      {
        recipe: 'compose',
        tasks: [],
        files: { 'compose.yml': 'services: {}\n' },
        compose: { services: { web: { build: {} } } },
        rollback: { host: 'web', target: R1 },
        remotes: withPrevious.remotes,
        setup: async (env) => {
          await previousRelease(env)
          const newer = env.releasePath('web', R2)
          await mkdir(newer, { recursive: true })
          const link = join(env.deployPath('web'), 'current')
          await rm(link)
          await symlink(newer, link)
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const [up] = composeCalls(run, 'web', 'up')
        assert.equal(up.cwd, run.env.releasePath('web', R1))
        assert.equal(await current(run.env), run.env.releasePath('web', R1))
      }
    )
  }).timeout(60_000)

  test('refuses a rollback target without the generated override', async ({ assert }) => {
    await scenario(
      {
        recipe: 'compose',
        tasks: [],
        files: { 'compose.yml': 'services: {}\n' },
        rollback: { host: 'web', target: R1 },
        remotes: withPrevious.remotes,
        setup: async (env) => {
          const target = env.releasePath('web', R1)
          await mkdir(target, { recursive: true })
          await writeFile(join(target, 'compose.yml'), 'services: {}\n')
          await writeFile(
            join(target, 'release.json'),
            JSON.stringify({ schemaVersion: 1, images: [{ ref: `localhost/app:${R1}` }] })
          )
          const newer = env.releasePath('web', R2)
          await mkdir(newer, { recursive: true })
          await symlink(newer, join(env.deployPath('web'), 'current'))
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(
          run.stderr,
          `release ${R1} is missing its Compose files or compose.catapult.yml`
        )
        assert.equal(await current(run.env), run.env.releasePath('web', R2))
      }
    )
  }).timeout(60_000)
})
