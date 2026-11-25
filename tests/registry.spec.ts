import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readlink, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type Run, R1, R2, calls, scenario } from './helpers/oci_harness.ts'

const REPOSITORY = 'registry.example.com/acme/app'
const PASSWORD = 's3cret-token'
const REGISTRY = {
  container_transfer: 'registry',
  container_registry: {
    repository: REPOSITORY,
    auth: { username_env: 'REG_USER', password_env: 'REG_TOKEN' },
  },
}
const CREDENTIALS = { REG_USER: 'bot', REG_TOKEN: PASSWORD, OCI_REGISTRY_PASSWORD: PASSWORD }

const remote = (run: Run, host: string, command: string) =>
  calls(run, `remote-deploy@${host}`, command)

test.group('registry transfer', () => {
  test('pushes once and pulls the image by digest on every host', async ({ assert }) => {
    await scenario(
      {
        remotes: [{ name: 'web1' }, { name: 'web2' }],
        store: REGISTRY,
        env: CREDENTIALS,
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const pushes = calls(run, 'local', 'push')
        assert.lengthOf(pushes, 1)
        assert.deepEqual(pushes[0].args, ['push', `${REPOSITORY}:${R1}`])
        // The registry tag is dropped locally once pushed: localhost/app keeps the image.
        assert.deepEqual(calls(run, 'local', 'rmi').at(-1)?.args, ['rmi', `${REPOSITORY}:${R1}`])

        const manifest = await run.manifest('web1')
        const registryRef = manifest?.images[0].registryRef as string
        assert.match(registryRef, new RegExp(`^${REPOSITORY}@sha256:[a-f0-9]{64}$`))
        for (const host of ['web1', 'web2']) {
          const [login] = remote(run, host, 'login')
          assert.includeMembers(login.args, ['--username', 'bot', '--password-stdin'])
          assert.equal(login.args.at(-1), 'registry.example.com')
          assert.equal(remote(run, host, 'pull')[0].args.at(-1), registryRef)
          const images = await run.images(host)
          assert.property(images, `localhost/app:${R1}`)
          const hostManifest = await run.manifest(host)
          assert.equal(hostManifest?.images[0].registryRef, registryRef)
        }

        assert.notInclude(JSON.stringify(run.calls), PASSWORD)
        assert.deepEqual(await readdir(run.env.tmpDir), [])
      }
    )
  }).timeout(60_000)

  test('logs in with a temporary config directory with Docker', async ({ assert }) => {
    await scenario(
      {
        remotes: [{ name: 'web', engines: ['docker'] }],
        localEngines: ['docker'],
        store: { ...REGISTRY, container_engine: 'docker' },
        env: CREDENTIALS,
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const [login] = remote(run, 'web', 'login')
        const [pull] = remote(run, 'web', 'pull')
        assert.isString((login as { config?: string }).config)
        assert.equal((pull as { config?: string }).config, (login as { config?: string }).config)
        assert.deepEqual(await readdir(run.env.tmpDir), [])
      }
    )
  }).timeout(60_000)

  test('pulls without login when no credentials are configured', async ({ assert }) => {
    await scenario(
      {
        store: { ...REGISTRY, container_registry: { repository: REPOSITORY } },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.lengthOf(remote(run, 'web', 'login'), 0)
        assert.lengthOf(remote(run, 'web', 'pull'), 1)
      }
    )
  }).timeout(60_000)

  test('reports rejected credentials without leaving files', async ({ assert }) => {
    await scenario(
      {
        store: REGISTRY,
        env: { ...CREDENTIALS, REG_TOKEN: 'wrong' },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, `pull of ${REPOSITORY}@sha256:`)
        assert.include(run.stderr, 'unauthorized: incorrect username or password')
        assert.deepEqual(await readdir(run.env.tmpDir), [])
      }
    )
  }).timeout(60_000)

  test('validates the registry configuration', async ({ assert }) => {
    const cases: [Record<string, unknown>, Record<string, string>, string][] = [
      [{ container_transfer: 'ftp' }, {}, 'container_transfer must be one of: ssh, registry'],
      [{ container_transfer: 'registry' }, {}, 'container_registry must be { repository, auth? }'],
      [
        { ...REGISTRY, container_registry: { repository: `${REPOSITORY}:latest` } },
        {},
        'must be a repository without tag or digest',
      ],
      [
        {
          ...REGISTRY,
          container_registry: { repository: REPOSITORY, auth: { username_env: 'REG_USER' } },
        },
        {},
        'container_registry.auth.password_env must be the name of an environment variable',
      ],
      [REGISTRY, { REG_USER: 'bot' }, 'REG_TOKEN is not set'],
    ]
    for (const [store, env, message] of cases) {
      await scenario({ store, env }, (run) => {
        assert.equal(run.exitCode, 1, message)
        assert.include(run.stderr, message)
        assert.lengthOf(calls(run, 'local', 'build'), 0)
      })
    }
  }).timeout(120_000)

  test('a rollback pulls the target image again when it is gone', async ({ assert }) => {
    const registryRef = `${REPOSITORY}@sha256:${'a'.repeat(64)}`
    await scenario(
      {
        store: REGISTRY,
        env: CREDENTIALS,
        tasks: [],
        rollback: { host: 'web', target: R1 },
        registryImages: { [registryRef]: 'sha256:old' },
        setup: async (env) => {
          const target = env.releasePath('web', R1)
          await mkdir(target, { recursive: true })
          await writeFile(
            join(target, 'release.json'),
            JSON.stringify({
              schemaVersion: 1,
              images: [{ ref: `localhost/app:${R1}`, localId: 'sha256:old', registryRef }],
            })
          )
          const active = env.releasePath('web', R2)
          await mkdir(active, { recursive: true })
          await symlink(active, join(env.deployPath('web'), 'current'))
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.equal(remote(run, 'web', 'pull')[0].args.at(-1), registryRef)
        const images = await run.images('web')
        assert.equal(images[`localhost/app:${R1}`], 'sha256:old')
        const link = join(run.env.deployPath('web'), 'current')
        assert.isTrue(existsSync(link))
        assert.equal(await readlink(link), run.env.releasePath('web', R1))
      }
    )
  }).timeout(60_000)
})
