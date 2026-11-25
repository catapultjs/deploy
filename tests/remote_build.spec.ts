import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cachedArgUses } from '../recipes/oci/build.ts'
import { rsyncExcludes } from '../recipes/oci/remote_build.ts'
import { R1, calls, scenario } from './helpers/oci_harness.ts'

const REMOTE = { container_build: { location: 'remote', args: { APP_VERSION: '2' } } }

test.group('remote build', () => {
  test('builds on each server without transfer', async ({ assert }) => {
    await scenario(
      { remotes: [{ name: 'web1' }, { name: 'web2' }], store: REMOTE },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.lengthOf(calls(run, 'local', 'build'), 0)
        assert.lengthOf(calls(run, 'local', 'save'), 0)
        const syncs = run.calls.filter((call) => call.bin === 'rsync')
        assert.lengthOf(syncs, 2)

        for (const [index, host] of ['web1', 'web2'].entries()) {
          const dir = join(run.env.deployPath(host), '.catapult', 'build')
          assert.includeMembers(syncs[index].args, ['--delete-excluded', '--exclude=/.git'])
          assert.equal(syncs[index].args.at(-1), `deploy@${host}:${dir}/`)
          assert.isTrue(existsSync(join(dir, 'Containerfile')))

          const [build] = calls(run, `remote-deploy@${host}`, 'build')
          assert.equal(build.cwd, dir)
          assert.includeMembers(build.args, [
            '--format',
            'docker',
            '-t',
            `localhost/app:${R1}`,
            '--build-arg',
            'APP_VERSION=2',
          ])
          assert.lengthOf(calls(run, `remote-deploy@${host}`, 'load'), 0)

          const manifest = await run.manifest(host)
          assert.isNull(manifest?.images[0].localId)
          assert.match(manifest?.images[0].contentKey, /^sha256:/)
          assert.isString(manifest?.images[0].remoteId)
        }
      }
    )
  }).timeout(60_000)

  test('checks the configuration and the server', async ({ assert }) => {
    const cases: [Parameters<typeof scenario>[0], string][] = [
      [
        { store: { container_build: { location: 'remote', platform: 'linux/amd64' } } },
        'container_build.platform cannot be used with location "remote"',
      ],
      [
        {
          store: {
            ...REMOTE,
            container_transfer: 'registry',
            container_registry: { repository: 'ghcr.io/acme/app' },
          },
        },
        'cannot be used with container_build.location "remote"',
      ],
      [
        { store: REMOTE, remotes: [{ name: 'web', rsync: false }] },
        'rsync is required on the server',
      ],
      [
        {
          store: { container_build: { location: 'remote', context: 'app', file: 'Containerfile' } },
        },
        'container_build.file must be inside the build context',
      ],
    ]
    for (const [options, message] of cases) {
      await scenario(options, (run) => {
        assert.equal(run.exitCode, 1, message)
        assert.include(run.stderr, message)
      })
    }
  }).timeout(120_000)

  test('translates the ignore file into rsync excludes', ({ assert }) => {
    assert.deepEqual(rsyncExcludes(null, ['Containerfile']), {
      args: ['--exclude=/.git'],
      translated: true,
    })
    assert.deepEqual(
      rsyncExcludes('node_modules\n# comment\n\n./dist/\n*.log\n/.env\n', [
        'Containerfile',
        '.dockerignore',
      ]),
      {
        args: [
          '--exclude=/.git',
          '--include=/Containerfile',
          '--include=/.dockerignore',
          '--exclude=/node_modules',
          '--exclude=/dist/',
          '--exclude=/*.log',
          '--exclude=/.env',
        ],
        translated: true,
      }
    )
    // A negation cannot be translated: the whole context is sent.
    assert.deepEqual(rsyncExcludes('*.md\n!README.md\n', ['Containerfile']), {
      args: ['--exclude=/.git'],
      translated: false,
    })
  })
})

test.group('podman build cache', () => {
  test('detects build arguments used before any RUN instruction', ({ assert }) => {
    const cases: [string, string[], string[]][] = [
      ['FROM x\nARG V=dev\nENV V=$V\nCOPY . .\nCMD ["node"]', ['V'], ['V']],
      ['FROM x\nARG V=dev\nRUN true\nENV E=$V', ['V'], []],
      ['FROM x\nARG V=dev\nENV E=${V}', ['OTHER'], []],
      ['FROM a\nARG V\nRUN echo $V\nFROM b\nARG V\nLABEL v=$V', ['V'], ['V']],
      ['FROM x\nARG A=1 B=2\nENV X=$A \\\n  Y=$B', ['A', 'B'], ['A', 'B']],
      ['FROM x\nENV E=$V\nARG V', ['V'], []],
    ]
    for (const [file, names, expected] of cases) {
      assert.sameMembers(cachedArgUses(file, names), expected, file)
    }
  })

  test('warns when a Podman build would keep a cached argument value', async ({ assert }) => {
    await scenario(
      {
        store: { container_build: { args: { APP_VERSION: '2' } } },
        files: {
          Containerfile: 'FROM scratch\nARG APP_VERSION=dev\nENV APP_VERSION=$APP_VERSION\n',
        },
      },
      (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.include(run.stdout, 'Podman caches instructions using APP_VERSION')
      }
    )
  }).timeout(60_000)
})
