import { test } from '@japa/runner'
import { mkdir, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execa } from 'execa'
import { set } from '../src/store.ts'
import { imageName, platformFromArch, project, releaseRef } from '../recipes/oci/config.ts'
import { releaseTags } from '../recipes/oci/cleanup.ts'
import { type OciEnv, R1, R2, calls, scenario } from './helpers/oci_harness.ts'

test.group('oci — configuration', () => {
  test('derives the project from package.json and validates names', ({ assert }) => {
    set('container_project', undefined)
    set('container_image', undefined)
    assert.equal(project(), 'deploy')
    assert.equal(imageName(), 'deploy')
    set('container_project', 'shop')
    set('container_image', 'shop-web')
    assert.equal(releaseRef(R1), `localhost/shop-web:${R1}`)
    set('container_project', 'Shop!')
    assert.throws(() => project(), /container_project/)
    set('container_image', 'ghcr.io/acme/app:1')
    assert.throws(() => imageName(), /container_image/)
    set('container_project', undefined)
    set('container_image', undefined)
  })

  test('maps architectures and filters release tags', ({ assert }) => {
    assert.equal(platformFromArch('x86_64'), 'linux/amd64')
    assert.equal(platformFromArch('aarch64'), 'linux/arm64')
    assert.equal(platformFromArch('arm64'), 'linux/arm64')
    set('container_image', 'app')
    assert.deepEqual(
      releaseTags(
        [
          `localhost/app:${R1}`,
          'localhost/app:stable',
          `localhost/other:${R2}`,
          `localhost/app:${R1}`,
        ].join('\n')
      ),
      [R1]
    )
    set('container_image', undefined)
  })
})

test.group('oci — build and transfer', () => {
  test('builds once locally, streams the image and writes the manifest', async ({ assert }) => {
    await scenario(
      { store: { container_build: { target: 'production', args: { NODE_VERSION: '24' } } } },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const [build] = calls(run, 'local', 'build')
        assert.deepEqual(build.args, [
          'build',
          '-f',
          join(run.env.root, 'project', 'Containerfile'),
          '-t',
          `localhost/app:${R1}`,
          '--platform',
          'linux/amd64',
          '--target',
          'production',
          '--build-arg',
          'NODE_VERSION=24',
          '--label',
          'com.catapultjs.project=app',
          join(run.env.root, 'project'),
        ])
        assert.deepEqual(calls(run, 'local', 'save')[0].args, [
          'save',
          '--format',
          'docker-archive',
          `localhost/app:${R1}`,
        ])
        assert.lengthOf(calls(run, 'remote-deploy@web', 'load'), 1)
        const remoteImages = await run.images('web')
        assert.equal(remoteImages[`localhost/app:${R1}`], 'sha256:built')

        const manifest = await run.manifest()
        assert.containSubset(manifest, {
          schemaVersion: 1,
          release: R1,
          recipe: 'oci',
          engine: 'podman',
          revision: null,
          dirty: false,
          images: [
            {
              ref: `localhost/app:${R1}`,
              localId: 'sha256:built',
              remoteId: 'sha256:built',
              platform: 'linux/amd64',
            },
          ],
        })
        const { mode } = await stat(run.manifestPath('web'))
        assert.equal(mode & 0o777, 0o600)
      }
    )
  }).timeout(30_000)

  test('reuses one build for several hosts of the same architecture', async ({ assert }) => {
    await scenario({ remotes: [{ name: 'web1' }, { name: 'web2' }] }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.lengthOf(calls(run, 'local', 'build'), 1)
      assert.lengthOf(calls(run, 'remote-deploy@web1', 'load'), 1)
      assert.lengthOf(calls(run, 'remote-deploy@web2', 'load'), 1)
      assert.isNotNull(await run.manifest('web2'))
    })
  }).timeout(30_000)

  test('rejects hosts with another architecture', async ({ assert }) => {
    await scenario({ remotes: [{ name: 'web1' }, { name: 'web2', arch: 'aarch64' }] }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'several architectures is not supported yet')
    })
  }).timeout(30_000)

  test('rejects a configured platform the server does not run', async ({ assert }) => {
    await scenario({ store: { container_build: { platform: 'linux/arm64' } } }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(
        run.stderr,
        'container_build.platform is linux/arm64 but the server runs linux/amd64'
      )
    })
  }).timeout(30_000)

  test('tags the previous image instead of transferring an unchanged build', async ({ assert }) => {
    await scenario(
      {
        release: R2,
        remotes: [{ name: 'web', images: { [`localhost/app:${R1}`]: 'sha256:built' } }],
        setup: async (env) => {
          const previous = join(env.deployPath('web'), 'releases', R1)
          await mkdir(previous, { recursive: true })
          await writeFile(
            join(previous, 'release.json'),
            JSON.stringify({
              schemaVersion: 1,
              images: [
                { ref: `localhost/app:${R1}`, localId: 'sha256:built', remoteId: 'sha256:built' },
              ],
            })
          )
          await symlink(previous, join(env.deployPath('web'), 'current'))
        },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.lengthOf(calls(run, 'local', 'save'), 0)
        assert.lengthOf(calls(run, 'remote-deploy@web', 'load'), 0)
        assert.deepEqual(calls(run, 'remote-deploy@web', 'tag')[0].args, [
          'tag',
          `localhost/app:${R1}`,
          `localhost/app:${R2}`,
        ])
        assert.include(run.stdout, 'image unchanged')
      }
    )
  }).timeout(30_000)

  test('builds with the other local engine and uses its save syntax', async ({ assert }) => {
    await scenario({ localEngines: ['docker'] }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.equal(calls(run, 'local', 'build')[0].bin, 'docker')
      assert.deepEqual(calls(run, 'local', 'save')[0].args, ['save', `localhost/app:${R1}`])
      assert.equal(calls(run, 'remote-deploy@web', 'load')[0].bin, 'podman')
    })
  }).timeout(30_000)

  test('streams without compression when disabled', async ({ assert }) => {
    await scenario({ store: { container_compression: 'none' } }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.lengthOf(calls(run, 'remote-deploy@web', 'load'), 1)
    })
  }).timeout(30_000)

  test('streams with zstd when the server has it', async ({ assert }) => {
    // zstd is optional on the machine running the tests.
    const { exitCode } = await execa('which', ['zstd'], { reject: false })
    if (exitCode !== 0) return
    await scenario({ store: { container_compression: 'zstd' } }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.lengthOf(calls(run, 'remote-deploy@web', 'load'), 1)
    })
  }).timeout(30_000)

  test('pulls and tags a source image instead of building', async ({ assert }) => {
    await scenario({ store: { container_source: 'ghcr.io/acme/app:1.2.3' } }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.lengthOf(calls(run, 'local', 'build'), 0)
      assert.deepEqual(calls(run, 'remote-deploy@web', 'pull')[0].args, [
        'pull',
        'ghcr.io/acme/app:1.2.3',
      ])
      assert.containSubset(await run.manifest(), {
        images: [
          {
            ref: `localhost/app:${R1}`,
            localId: null,
            remoteId: 'sha256:pulled',
            source: 'ghcr.io/acme/app:1.2.3',
          },
        ],
      })
    })
  }).timeout(30_000)

  test('records the revision and warns about uncommitted changes and .env', async ({ assert }) => {
    await scenario({ git: 'dirty', files: { '.env': 'SECRET=1' } }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.include(run.stdout, 'uncommitted changes')
      assert.include(run.stdout, '.env is not excluded')
      const manifest = await run.manifest()
      assert.match(manifest.revision, /^[0-9a-f]{40}$/)
      assert.isTrue(manifest.dirty)
    })
  }).timeout(30_000)

  test('does not warn when .env is ignored and the tree is clean', async ({ assert }) => {
    await scenario(
      { git: 'clean', files: { '.env': 'SECRET=1', '.containerignore': '.env\nnode_modules\n' } },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.notInclude(run.stdout, 'uncommitted changes')
        assert.notInclude(run.stdout, '.env is not excluded')
        const manifest = await run.manifest()
        assert.isFalse(manifest.dirty)
      }
    )
  }).timeout(30_000)
})

test.group('oci — failures', () => {
  test('fails when the server has no engine', async ({ assert }) => {
    await scenario({ remotes: [{ name: 'web', engines: [] }] }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'no container engine found (looked for podman, docker)')
    })
  }).timeout(30_000)

  test('fails when the engine is not usable by the deploy user', async ({ assert }) => {
    await scenario({ env: { OCI_FAIL: 'remote-deploy@web:info' } }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'podman is installed but not usable by this user: info failed')
    })
  }).timeout(30_000)

  test('warns when linger is disabled for rootless podman', async ({ assert }) => {
    await scenario({ tasks: ['oci:check'], env: { FAKE_LINGER: 'no' } }, (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.include(run.stdout, 'linger is disabled')
    })
  }).timeout(30_000)

  test('surfaces a local save failure and writes no manifest', async ({ assert }) => {
    await scenario({ env: { OCI_FAIL: 'local:save' } }, async (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'save failed')
      assert.isNull(await run.manifest())
    })
  }).timeout(30_000)

  test('surfaces a remote load failure and writes no manifest', async ({ assert }) => {
    await scenario({ env: { OCI_FAIL: 'remote-deploy@web:load' } }, async (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'load failed')
      assert.isNull(await run.manifest())
    })
  }).timeout(30_000)

  test('rejects unsupported transfer modes and a transfer without build', async ({ assert }) => {
    await scenario({ store: { container_transfer: 'registry' }, tasks: ['oci:check'] }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'container_transfer "registry" is not supported yet')
    })
    await scenario({ tasks: ['deploy:release', 'oci:transfer'] }, (run) => {
      assert.equal(run.exitCode, 1)
      assert.include(run.stderr, 'oci:build must run before oci:transfer')
    })
  }).timeout(30_000)
})

test.group('oci — cleanup and rollback', () => {
  test('removes only stale release tags, on the server and locally', async ({ assert }) => {
    const R0 = '2026-11-24T09-00-00-000Z'
    const old = ['2026-11-20T00-00-00-000Z', '2026-11-21T00-00-00-000Z', '2026-11-22T00-00-00-000Z']
    await scenario(
      {
        tasks: ['oci:check', 'oci:build', 'deploy:release', 'oci:transfer', 'oci:cleanup'],
        store: { container_keep_local: 2 },
        remotes: [
          {
            name: 'web',
            images: {
              [`localhost/app:${R0}`]: 'sha256:r0',
              'localhost/app:2026-11-23T09-00-00-000Z': 'sha256:busy',
              'localhost/app:stable': 'sha256:stable',
              [`localhost/other:${R0}`]: 'sha256:other',
            },
          },
        ],
        localImages: Object.fromEntries(
          old.map((tag) => [`localhost/app:${tag}`, `sha256:${tag}`])
        ),
        env: { OCI_IN_USE: 'localhost/app:2026-11-23T09-00-00-000Z' },
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        assert.include(run.stdout, 'could not remove localhost/app:2026-11-23T09-00-00-000Z')
        assert.sameMembers(Object.keys(await run.images('web')), [
          `localhost/app:${R1}`,
          'localhost/app:2026-11-23T09-00-00-000Z',
          'localhost/app:stable',
          `localhost/other:${R0}`,
        ])
        assert.sameMembers(Object.keys(await run.images('local')), [
          `localhost/app:${R1}`,
          `localhost/app:${old[2]}`,
        ])
      }
    )
  }).timeout(30_000)

  test('refuses a rollback target without manifest or without image', async ({ assert }) => {
    const prepare = (withManifest: boolean) => async (env: OciEnv) => {
      const releases = join(env.deployPath('web'), 'releases')
      for (const release of [R1, R2]) await mkdir(join(releases, release), { recursive: true })
      if (withManifest) {
        await writeFile(
          join(releases, R1, 'release.json'),
          JSON.stringify({ schemaVersion: 1, images: [{ ref: `localhost/app:${R1}` }] })
        )
      }
      await symlink(join(releases, R2), join(env.deployPath('web'), 'current'))
    }

    await scenario(
      { tasks: [], rollback: { host: 'web', target: R1 }, setup: prepare(false) },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, `release ${R1} has no release.json`)
      }
    )
    await scenario(
      { tasks: [], rollback: { host: 'web', target: R1 }, setup: prepare(true) },
      (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(
          run.stderr,
          `image localhost/app:${R1} of release ${R1} is missing on the server`
        )
      }
    )
    await scenario(
      {
        tasks: [],
        rollback: { host: 'web', target: R1 },
        remotes: [{ name: 'web', images: { [`localhost/app:${R1}`]: 'sha256:r1' } }],
        setup: prepare(true),
      },
      (run) => assert.equal(run.exitCode, 0, run.stderr)
    )
  }).timeout(30_000)
})
