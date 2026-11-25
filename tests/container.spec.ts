import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readlink, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type OciEnv, R1, R2, calls, scenario } from './helpers/oci_harness.ts'

const CONTAINER = { recipe: 'container', deploy: true }
const WEB = { web: { command: ['node', 'bin/server.js'] } }
const CATAPULT = (service: string, release = R1) => ({
  'com.catapultjs.project': 'app',
  'com.catapultjs.service': service,
  'com.catapultjs.release': release,
})

const sharedEnv = async (env: OciEnv) => {
  await mkdir(join(env.deployPath('web'), 'shared'), { recursive: true })
  await writeFile(join(env.deployPath('web'), 'shared', '.env'), 'APP_KEY=secret\n')
}

/** A previous release R1, current and restorable, running one "web" container. */
async function previousRelease(env: OciEnv) {
  const release = env.releasePath('web', R1)
  await mkdir(release, { recursive: true })
  await writeFile(
    join(release, 'release.json'),
    JSON.stringify({
      schemaVersion: 1,
      images: [{ ref: `localhost/app:${R1}`, localId: 'sha256:old', remoteId: 'sha256:old' }],
      container: {
        network: 'app',
        services: {
          web: {
            command: ['node', 'old.js'],
            entrypoint: null,
            user: null,
            envFiles: [],
            envKeys: [],
            ports: [],
            volumes: [],
            restart: 'always',
            labels: {},
          },
        },
      },
    })
  )
  await symlink(release, join(env.deployPath('web'), 'current'))
}

const withPrevious = {
  release: R2,
  remotes: [
    {
      name: 'web',
      images: { [`localhost/app:${R1}`]: 'sha256:old' },
      containers: { 'app-web': { service: 'web', release: R1, labels: CATAPULT('web') } },
    },
  ],
  setup: previousRelease,
}

async function current(env: OciEnv) {
  const link = join(env.deployPath('web'), 'current')
  return existsSync(link) ? readlink(link) : null
}

const runs = (run: Parameters<Parameters<typeof scenario>[1]>[0]) =>
  calls(run, 'remote-deploy@web', 'run')

test.group('container — deploy', () => {
  test('starts every service from the release image', async ({ assert }) => {
    await scenario(
      {
        ...CONTAINER,
        setup: sharedEnv,
        store: {
          shared_files: ['.env'],
          container_services: {
            web: {
              command: ['node', 'bin/server.js'],
              user: 'node',
              env: { PORT: '3333' },
              env_file: ['.env'],
              ports: ['127.0.0.1:3333:3333'],
              volumes: ['./storage:/app/storage', 'data:/data:ro'],
              labels: { 'traefik.enable': 'true' },
            },
            worker: {
              command: ['node', 'ace', 'queue:work'],
              restart: 'unless-stopped',
              init: true,
              healthcheck: false,
            },
          },
          container_migrate: { service: 'web', command: ['node', 'ace', 'migration:run'] },
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const release = run.env.releasePath('web', R1)
        const envFile = join(release, 'container', 'web.env')
        assert.equal(await readFile(envFile, 'utf8'), 'PORT=3333\n')
        const { mode } = await stat(envFile)
        assert.equal(mode & 0o777, 0o600)

        const [migration, web, worker] = runs(run).map((call) => call.args)
        assert.deepEqual(migration, [
          'run',
          '--rm',
          '--network',
          'app',
          '--label',
          'com.catapultjs.oneoff=true',
          '--label',
          'com.catapultjs.project=app',
          '--label',
          `com.catapultjs.release=${R1}`,
          '--user',
          'node',
          '--env-file',
          envFile,
          '--env-file',
          join(release, '.env'),
          '-v',
          `${release}/storage:/app/storage`,
          '-v',
          'data:/data:ro',
          `localhost/app:${R1}`,
          'node',
          'ace',
          'migration:run',
        ])
        assert.deepEqual(web, [
          'run',
          '-d',
          '--name',
          'app-web',
          '--network',
          'app',
          '--restart',
          'always',
          '--label',
          'com.catapultjs.service=web',
          '--label',
          'com.catapultjs.project=app',
          '--label',
          `com.catapultjs.release=${R1}`,
          '--label',
          'traefik.enable=true',
          '--user',
          'node',
          '--env-file',
          envFile,
          '--env-file',
          join(release, '.env'),
          '-p',
          '127.0.0.1:3333:3333',
          '-v',
          `${release}/storage:/app/storage`,
          '-v',
          'data:/data:ro',
          `localhost/app:${R1}`,
          'node',
          'bin/server.js',
        ])
        assert.includeMembers(worker, [
          '--name',
          'app-worker',
          '--restart',
          'unless-stopped',
          '--init',
          '--no-healthcheck',
        ])
        assert.notInclude(web, '--init')
        assert.notInclude(web, '--no-healthcheck')
        assert.lengthOf(
          calls(run, 'remote-deploy@web', 'network').filter((c) => c.args[1] === 'create'),
          1
        )
        assert.equal(await current(run.env), release)

        const manifest = await run.manifest()
        assert.equal(manifest.recipe, 'container')
        assert.deepEqual(manifest.container.services.web.envKeys, ['PORT'])
        assert.notInclude(JSON.stringify(manifest), '3333\\n')
        assert.notInclude(JSON.stringify(manifest), 'PORT=3333')
        assert.include(run.stdout, '2 container(s) ready')
      }
    )
  }).timeout(60_000)

  test('replaces the running container and removes services no longer configured', async ({
    assert,
  }) => {
    await scenario(
      {
        ...CONTAINER,
        ...withPrevious,
        remotes: [
          {
            ...withPrevious.remotes[0],
            containers: {
              'app-web': { service: 'web', release: R1, labels: CATAPULT('web') },
              'app-legacy': { service: 'legacy', release: R1, labels: CATAPULT('legacy') },
              'other-web': { service: 'web', labels: { 'com.catapultjs.project': 'other' } },
            },
          },
        ],
        store: { container_services: WEB },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const removed = calls(run, 'remote-deploy@web', 'rm').map((call) => call.args.at(-1))
        assert.deepEqual(removed, ['app-web', 'app-legacy'])
        assert.deepEqual(
          calls(run, 'remote-deploy@web', 'stop').map((call) => call.args),
          [
            ['stop', '-t', '10', 'app-web'],
            ['stop', '-t', '10', 'app-legacy'],
          ]
        )
        assert.include(run.stdout, 'remove app-legacy')
      }
    )
  }).timeout(60_000)
})

test.group('container — failures', () => {
  test('a failed migration blocks publication', async ({ assert }) => {
    await scenario(
      {
        ...CONTAINER,
        store: {
          container_services: WEB,
          container_migrate: { service: 'web', command: ['false'] },
        },
        env: { OCI_FAIL: 'remote-deploy@web:run-rm' },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        // stdout then stderr, without the Compose-like progress line in between.
        assert.include(
          run.stderr,
          'migration failed (exit code 1): error: column already exists\nrun-rm failed'
        )
        assert.lengthOf(runs(run), 1)
        assert.isNull(await current(run.env))
      }
    )
  }).timeout(60_000)

  test('rolls back to the previous containers when the new ones crash', async ({ assert }) => {
    await scenario(
      {
        ...CONTAINER,
        ...withPrevious,
        store: { container_services: WEB },
        statuses: { [`web@${R2}`]: 'running|Up 1 second;exited|Exited (1) 1 second ago' },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stdout, 'auto rollback OK')
        const started = runs(run).map((call) => call.args.at(-1))
        assert.deepEqual(started, ['bin/server.js', 'old.js'])
        assert.include(runs(run)[1].args, `localhost/app:${R1}`)
        assert.equal(await current(run.env), run.env.releasePath('web', R1))
      }
    )
  }).timeout(60_000)

  test('validates the service configuration', async ({ assert }) => {
    const cases: [Record<string, unknown>, string][] = [
      [{}, 'container_services must define at least one service'],
      [
        { container_services: { web: { volumes: ['../x:/x'] } } },
        'must stay inside the release directory',
      ],
      [
        { container_services: { web: { volumes: ['data'] } } },
        'must look like source:/container/path',
      ],
      [{ container_services: { web: { env: { KEY: 'a\nb' } } } }, 'must be a single-line string'],
      [
        { container_services: { web: { labels: { 'com.catapultjs.x': '1' } } } },
        'com.catapultjs. prefix',
      ],
      [{ container_services: { web: { restart: 'sometimes' } } }, 'restart must be'],
      [
        { container_services: WEB, container_migrate: { service: 'api', command: ['x'] } },
        'container_migrate.service must be one of: web',
      ],
      [{ container_services: { web: { env_file: ['.env'] } } }, 'env_file not found'],
    ]
    for (const [store, message] of cases) {
      await scenario({ ...CONTAINER, store }, (run) => {
        assert.equal(run.exitCode, 1, JSON.stringify(store))
        assert.include(run.stderr, message)
      })
    }
  }).timeout(120_000)
})

test.group('container — checks and rollback', () => {
  test('warns when podman-restart.service is disabled', async ({ assert }) => {
    await scenario(
      {
        recipe: 'container',
        tasks: ['oci:check', 'container:check'],
        store: { container_services: WEB },
        env: { FAKE_RESTART: 'disabled' },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.include(run.stdout, 'podman-restart.service is not enabled')
      }
    )
  }).timeout(60_000)

  test('refuses a rollback target without container configuration', async ({ assert }) => {
    await scenario(
      {
        recipe: 'container',
        tasks: [],
        store: { container_services: WEB },
        rollback: { host: 'web', target: R1 },
        remotes: withPrevious.remotes,
        setup: async (env) => {
          const target = env.releasePath('web', R1)
          await mkdir(target, { recursive: true })
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
        assert.include(run.stderr, `release ${R1} has no container configuration`)
        assert.equal(await current(run.env), run.env.releasePath('web', R2))
      }
    )
  }).timeout(60_000)
})
