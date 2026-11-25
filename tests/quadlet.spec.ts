import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readlink, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type OciEnv, type Run, R1, R2, calls, scenario } from './helpers/oci_harness.ts'

const QUADLET = { recipe: 'quadlet', deploy: true }

const WEB = `[Unit]
Description=web

[Container]
Image={{image}}
EnvironmentFile={{release_path}}/.env
Volume={{shared_path}}/storage:/app/storage

[Install]
WantedBy=default.target
`

const REDIS = `[Container]
Image=docker.io/library/redis:7

[Install]
WantedBy=default.target
`

/** REDIS as rendered: the project and service labels follow [Container]. */
const REDIS_RENDERED = `[Container]
Label=com.catapultjs.project=app
Label=com.catapultjs.service=app-redis
Image=docker.io/library/redis:7

[Install]
WantedBy=default.target
`

const FILES = {
  'quadlet/app-web.container': WEB,
  'quadlet/app-redis.container': REDIS,
  'quadlet/app.network': '[Network]\n',
}

const installed = (env: OciEnv, name: string) => join(env.quadletDir, 'app', name)

const systemctl = (run: Run, command: string) =>
  run.calls.filter(
    (call) => call.bin === 'systemctl' && call.args[0] === '--user' && call.args[1] === command
  )

async function current(env: OciEnv) {
  const link = join(env.deployPath('web'), 'current')
  return existsSync(link) ? readlink(link) : null
}

/** A previous release R1, current and restorable, with its rendered units installed. */
async function previousRelease(env: OciEnv) {
  const release = env.releasePath('web', R1)
  const web = `[Container]\nLabel=com.catapultjs.project=app\nLabel=com.catapultjs.service=app-web\nImage=localhost/app:${R1}\n`
  await mkdir(join(release, 'quadlet'), { recursive: true })
  await mkdir(join(env.quadletDir, 'app'), { recursive: true })
  await writeFile(join(release, 'quadlet', 'app-web.container'), web)
  await writeFile(installed(env, 'app-web.container'), web)
  await writeFile(
    join(release, 'release.json'),
    JSON.stringify({
      schemaVersion: 1,
      images: [{ ref: `localhost/app:${R1}`, localId: 'sha256:old', remoteId: 'sha256:old' }],
      quadlet: { files: ['app-web.container'] },
    })
  )
  await symlink(release, join(env.deployPath('web'), 'current'))
}

const withPrevious = {
  release: R2,
  remotes: [{ name: 'web', images: { [`localhost/app:${R1}`]: 'sha256:old' } }],
  setup: previousRelease,
}

test.group('quadlet — deploy', () => {
  test('renders, validates and installs the units, then starts them', async ({ assert }) => {
    await scenario({ ...QUADLET, files: FILES }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      const release = run.env.releasePath('web', R1)
      const web = await readFile(installed(run.env, 'app-web.container'), 'utf8')
      assert.include(
        web,
        '[Container]\nLabel=com.catapultjs.project=app\nLabel=com.catapultjs.service=app-web\n'
      )
      assert.include(web, `Image=localhost/app:${R1}\n`)
      assert.include(web, `EnvironmentFile=${release}/.env\n`)
      assert.include(web, `Volume=${run.env.deployPath('web')}/shared/storage:/app/storage\n`)
      assert.equal(
        await readFile(installed(run.env, 'app-redis.container'), 'utf8'),
        REDIS_RENDERED
      )
      const info = await stat(installed(run.env, 'app-web.container'))
      assert.equal(info.mode & 0o777, 0o600)
      assert.equal(await readFile(join(release, 'quadlet', 'app-web.container'), 'utf8'), web)

      const generator = run.calls.filter((call) => call.bin === 'quadlet')
      assert.lengthOf(generator, 1)
      assert.equal(generator[0].cwd, join(release, 'quadlet'))
      assert.includeMembers(generator[0].args, ['-dryrun', '-user'])

      assert.lengthOf(systemctl(run, 'daemon-reload'), 1)
      assert.sameMembers(systemctl(run, 'restart')[0].args.slice(2), [
        'app-network.service',
        'app-redis.service',
        'app-web.service',
      ])
      assert.sameMembers(systemctl(run, 'start')[0].args.slice(2), [
        'app-redis.service',
        'app-web.service',
      ])
      const manifest = await run.manifest()
      assert.deepEqual(manifest?.quadlet, {
        files: ['app-redis.container', 'app-web.container', 'app.network'],
      })
      assert.equal(await current(run.env), release)
    })
  }).timeout(60_000)

  test('restarts changed units only and removes units left the project', async ({ assert }) => {
    await scenario(
      {
        ...QUADLET,
        files: FILES,
        setup: async (env) => {
          await mkdir(join(env.quadletDir, 'app'), { recursive: true })
          await writeFile(installed(env, 'app-redis.container'), REDIS_RENDERED)
          await writeFile(installed(env, 'app.network'), '[Network]\n')
          await writeFile(installed(env, 'app-web.container'), '[Container]\nImage=old\n')
          await writeFile(installed(env, 'app-old.container'), '[Container]\nImage=old\n')
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.deepEqual(systemctl(run, 'restart')[0].args.slice(2), ['app-web.service'])
        assert.deepEqual(systemctl(run, 'stop')[0].args.slice(2), ['app-old.service'])
        assert.isFalse(existsSync(installed(run.env, 'app-old.container')))
        const resets = systemctl(run, 'reset-failed').flatMap((call) => call.args.slice(2))
        assert.include(resets, 'app-old.service')
        assert.include(run.stdout, 'remove app-old.service')
      }
    )
  }).timeout(60_000)

  test('validates the Quadlet files of the project', async ({ assert }) => {
    const container = (body: string) => ({
      'quadlet/app-web.container': `[Container]\n${body}\n[Install]\nWantedBy=default.target\n`,
    })
    const cases: [Record<string, string>, string][] = [
      [container('Image={{image}}\nExec={{nope}}'), 'unknown placeholder {{nope}}'],
      [container('Image=localhost/app:latest'), 'use Image={{image}}'],
      [container('Image={{image}}\nLabel=com.catapultjs.project=x'), 'are reserved'],
      [container('Image={{image}}\nServiceName=web'), 'ServiceName= is not supported'],
      [
        { ...container('Image={{image}}'), 'quadlet/app.kube': '' },
        '.kube files are not supported',
      ],
      [{ ...container('Image={{image}}'), 'quadlet/README.md': '' }, 'README.md: unsupported file'],
      [{ 'quadlet/app.network': '[Network]\n' }, 'at least one .container file'],
      [{ 'quadlet/app-web.container': 'Image={{image}}\n' }, 'missing [Container] section'],
    ]
    for (const [files, message] of cases) {
      await scenario({ ...QUADLET, files }, (run) => {
        assert.equal(run.exitCode, 1, JSON.stringify(files))
        assert.include(run.stderr, message)
        assert.lengthOf(calls(run, 'local', 'build'), 0)
      })
    }
  }).timeout(120_000)

  test('warns about units missing [Install] or the release image, except oneshot units', async ({
    assert,
  }) => {
    await scenario(
      {
        recipe: 'quadlet',
        tasks: ['deploy:release', 'quadlet:render'],
        files: { 'quadlet/app-redis.container': '[Container]\nImage=redis:7\n' },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.include(run.stdout, 'app-redis.container has no [Install] section')
        assert.include(run.stdout, 'no unit uses the release image')
      }
    )
    await scenario(
      {
        recipe: 'quadlet',
        tasks: ['deploy:release', 'quadlet:render'],
        files: {
          'quadlet/app-migrate.container':
            '[Container]\nImage={{image}}\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\n',
        },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.notInclude(run.stdout, 'has no [Install] section')
        assert.notInclude(run.stdout, 'no unit uses the release image')
      }
    )
  }).timeout(60_000)

  test('invalid units stop the deployment before the build', async ({ assert }) => {
    await scenario(
      {
        ...QUADLET,
        files: FILES,
        env: { FAKE_QUADLET_ERROR: 'converting "app-web.container": unsupported key \'Foo\'' },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        // Without the generator prefix and its "Loading source unit file" lines.
        assert.include(
          run.stderr,
          `invalid Quadlet files in release ${R1}: converting "app-web.container": unsupported key`
        )
        assert.lengthOf(calls(run, 'local', 'build'), 0)
        assert.isNull(await current(run.env))
      }
    )
  }).timeout(60_000)
})

test.group('quadlet — checks', () => {
  test('checks what Quadlet needs on the server', async ({ assert }) => {
    const cases: [Partial<Parameters<typeof scenario>[0]>, string][] = [
      [
        { store: { container_engine: 'docker' }, remotes: [{ name: 'web', engines: ['docker'] }] },
        'Quadlet requires Podman, found docker',
      ],
      [{ env: { FAKE_LINGER: 'no' } }, 'linger is disabled'],
      [{ env: { FAKE_MANAGER: 'no' } }, 'systemd user manager is not reachable'],
      [{ env: { FAKE_CGROUP: 'tmpfs' } }, 'cgroups v2 is not enabled'],
      [
        {
          setup: async (env) => {
            await mkdir(join(env.quadletDir, 'other'), { recursive: true })
            await writeFile(join(env.quadletDir, 'other', 'app-web.container'), '')
          },
        },
        'units with the same name are installed outside this project',
      ],
    ]
    for (const [options, message] of cases) {
      await scenario(
        { recipe: 'quadlet', tasks: ['oci:check', 'quadlet:check'], files: FILES, ...options },
        (run) => {
          assert.equal(run.exitCode, 1, message)
          assert.include(run.stderr, message)
        }
      )
    }
  }).timeout(120_000)
})

test.group('quadlet — failures and rollback', () => {
  test('rolls back to the previous units on a crash loop', async ({ assert }) => {
    await scenario(
      {
        ...QUADLET,
        ...withPrevious,
        files: { 'quadlet/app-web.container': WEB },
        env: {
          FAKE_UNITS: JSON.stringify({
            [`app-web@${R2}`]:
              'activating|auto-restart|1;activating|auto-restart|2;activating|auto-restart|3',
          }),
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'units restarted while starting (crash loop): app-web.service')
        assert.include(run.stdout, 'auto rollback OK')
        const web = await readFile(installed(run.env, 'app-web.container'), 'utf8')
        assert.include(web, `Image=localhost/app:${R1}\n`)
        assert.equal(await current(run.env), run.env.releasePath('web', R1))
      }
    )
  }).timeout(60_000)

  test('reports a unit that fails to start', async ({ assert }) => {
    await scenario({ ...QUADLET, files: FILES, env: { FAKE_UNIT_FAIL: 'app-web' } }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'systemctl failed: Job for app-web.service failed')
      assert.include(run.stderr, 'cata task quadlet:logs')
    })
  }).timeout(60_000)

  test('reports units not active', async ({ assert }) => {
    await scenario(
      {
        ...QUADLET,
        files: FILES,
        env: { FAKE_UNITS: JSON.stringify({ 'app-web': 'failed|failed|0' }) },
      },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'units not active: app-web.service (failed/failed)')
      }
    )
  }).timeout(60_000)

  test('refuses a rollback target missing its rendered files', async ({ assert }) => {
    await scenario(
      {
        recipe: 'quadlet',
        tasks: [],
        files: FILES,
        rollback: { host: 'web', target: R1 },
        remotes: withPrevious.remotes,
        setup: async (env) => {
          const target = env.releasePath('web', R1)
          await mkdir(target, { recursive: true })
          await writeFile(
            join(target, 'release.json'),
            JSON.stringify({
              schemaVersion: 1,
              images: [
                { ref: `localhost/app:${R1}`, localId: 'sha256:old', remoteId: 'sha256:old' },
              ],
              quadlet: { files: ['app-web.container'] },
            })
          )
          const active = env.releasePath('web', R2)
          await mkdir(active, { recursive: true })
          await symlink(active, join(env.deployPath('web'), 'current'))
        },
        release: R2,
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, `release ${R1} is missing its Quadlet files`)
        assert.equal(await current(run.env), run.env.releasePath('web', R2))
      }
    )
  }).timeout(60_000)

  test('manual tasks act on the units of the release', async ({ assert }) => {
    await scenario(
      {
        recipe: 'quadlet',
        files: FILES,
        remotes: withPrevious.remotes,
        setup: previousRelease,
        tasks: ['quadlet:stop', 'quadlet:logs'],
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.deepEqual(systemctl(run, 'stop')[0].args.slice(2), ['app-web.service'])
        assert.include(run.stdout, 'journal: --user -u app-web.service -n 100 --no-pager')
      }
    )
  }).timeout(60_000)
})
