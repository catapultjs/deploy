import { test } from '@japa/runner'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { set } from '../src/store.ts'
import { imageName, platformFromArch, project, releaseRef } from '../recipes/oci/config.ts'
import { releaseTags } from '../recipes/oci/cleanup.ts'

const R1 = '2026-11-25T10-00-00-000Z'
const R2 = '2026-11-25T11-00-00-000Z'
const FIXTURE = fileURLToPath(new URL('./fixtures/run_oci.ts', import.meta.url))
const TOOLS = [
  'bash',
  'sh',
  'base64',
  'gzip',
  'zstd',
  'cat',
  'head',
  'tail',
  'df',
  'awk',
  'id',
  'ls',
  'mv',
  'rm',
  'tr',
  'mkdir',
  'git',
  'env',
  'wc',
  'sort',
  'sed',
  'grep',
  'basename',
  'dirname',
  'readlink',
  'ln',
]

// Local and remote engines share one emulator. State is kept per side ("local" or
// "remote-<ssh target>") in OCI_STATE, every call is logged to OCI_LOG.
const ENGINE = `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const name = path.basename(process.argv[1])
const side = process.env.OCI_SIDE || 'local'
const [cmd, ...rest] = process.argv.slice(2)
const file = path.join(process.env.OCI_STATE, side + '.json')
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { images: {} }
const save = () => fs.writeFileSync(file, JSON.stringify(state))
fs.appendFileSync(process.env.OCI_LOG, JSON.stringify({ side, bin: name, args: [cmd, ...rest] }) + '\\n')
const fail = (message) => { process.stderr.write(message + '\\n'); process.exit(1) }
if ((process.env.OCI_FAIL || '').split(',').includes(side + ':' + cmd)) fail(cmd + ' failed')
switch (cmd) {
  case '--version': console.log(name + ' version 9.9.9'); break
  case 'info': console.log(process.env.OCI_STATE); break
  case 'build': state.images[rest[rest.indexOf('-t') + 1]] = process.env.OCI_BUILD_ID || 'sha256:built'; save(); break
  case 'image': { const ref = rest.at(-1); if (!state.images[ref]) fail('no such image ' + ref); console.log(state.images[ref]); break }
  case 'save': { const ref = rest.at(-1); if (!state.images[ref]) fail('no such image'); process.stdout.write('ARCHIVE ' + ref + ' ' + state.images[ref] + '\\n' + 'x'.repeat(64 * 1024)); break }
  case 'load': { const data = fs.readFileSync(0, 'utf8'); const m = data.match(/^ARCHIVE (\\S+) (\\S+)\\n/); if (!m) fail('invalid archive'); state.images[m[1]] = m[2]; save(); console.log('Loaded image: ' + m[1]); break }
  case 'tag': if (!state.images[rest[0]]) fail('no such image'); state.images[rest[1]] = state.images[rest[0]]; save(); break
  case 'pull': state.images[rest[0]] = 'sha256:pulled'; save(); break
  case 'rmi': if ((process.env.OCI_IN_USE || '').split(',').includes(rest[0])) fail('image is in use'); delete state.images[rest[0]]; save(); break
  case 'images': for (const ref of Object.keys(state.images)) if (ref.startsWith(rest.at(-1) + ':')) console.log(ref); break
  default: fail('unknown command ' + cmd)
}
`

// Runs remote commands locally with bash, with the PATH and architecture of the targeted server.
const SSH = `#!${process.execPath}
const { spawnSync } = require('node:child_process')
const target = process.argv.at(-2)
const remote = JSON.parse(process.env.OCI_REMOTES)[target]
const command = Buffer.from(process.argv.at(-1).match(/echo ([A-Za-z0-9+/=]+)\\|/)[1], 'base64').toString()
const result = spawnSync('bash', ['-c', command], {
  stdio: 'inherit',
  env: { ...process.env, OCI_SIDE: 'remote-' + target, FAKE_ARCH: remote.arch, PATH: remote.path },
})
process.exit(result.status ?? 1)
`

interface Remote {
  name: string
  engines?: string[]
  arch?: string
  images?: Record<string, string>
}

interface Scenario {
  store?: Record<string, unknown>
  release?: string
  remotes?: Remote[]
  localEngines?: string[]
  localImages?: Record<string, string>
  tasks?: string[]
  rollback?: { host: string; target: string }
  env?: Record<string, string>
  files?: Record<string, string>
  git?: 'clean' | 'dirty'
  setup?: (env: OciEnv) => Promise<void>
}

interface OciEnv {
  root: string
  deployPath: (host: string) => string
}

async function linkTools(directory: string) {
  await mkdir(directory)
  for (const tool of TOOLS) {
    const { stdout, exitCode } = await execa('which', [tool], { reject: false })
    if (exitCode === 0 && stdout.trim()) await symlink(stdout.trim(), join(directory, tool))
  }
}

async function binDir(directory: string, engines: string[]) {
  await mkdir(directory, { recursive: true })
  for (const engine of engines) await writeFile(join(directory, engine), ENGINE, { mode: 0o755 })
}

async function runOci(options: Scenario) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cata-oci-')))
  const projectDir = join(root, 'project')
  const state = join(root, 'state')
  const log = join(root, 'calls.jsonl')
  const tools = join(root, 'tools')
  const shared = join(root, 'shared-bin')
  const remotes = options.remotes ?? [{ name: 'web' }]
  const env: OciEnv = { root, deployPath: (host) => join(root, 'srv', host) }

  try {
    await mkdir(projectDir)
    await mkdir(state)
    await writeFile(log, '')
    await linkTools(tools)
    await binDir(shared, [])
    await writeFile(join(shared, 'ssh'), SSH, { mode: 0o755 })
    await writeFile(join(shared, 'uname'), '#!/bin/sh\necho "${FAKE_ARCH:-x86_64}"\n', {
      mode: 0o755,
    })
    await writeFile(join(shared, 'loginctl'), '#!/bin/sh\necho "${FAKE_LINGER:-yes}"\n', {
      mode: 0o755,
    })
    await binDir(join(root, 'local-bin'), options.localEngines ?? ['podman'])
    await writeFile(join(projectDir, 'Containerfile'), 'FROM scratch\n')
    for (const [file, content] of Object.entries(options.files ?? {})) {
      await writeFile(join(projectDir, file), content)
    }
    if (options.git) {
      const git = (args: string[]) => execa('git', args, { cwd: projectDir })
      await git(['init', '-q'])
      await git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.'])
      await git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'])
      if (options.git === 'dirty') await writeFile(join(projectDir, 'dirty.txt'), 'x')
    }
    if (options.localImages) {
      await writeFile(join(state, 'local.json'), JSON.stringify({ images: options.localImages }))
    }

    const remoteEnv: Record<string, { arch: string; path: string }> = {}
    for (const remote of remotes) {
      const target = `deploy@${remote.name}`
      const bin = join(root, `remote-bin-${remote.name}`)
      await binDir(bin, remote.engines ?? ['podman'])
      remoteEnv[target] = {
        arch: remote.arch ?? 'x86_64',
        path: [bin, shared, tools].join(delimiter),
      }
      await mkdir(join(env.deployPath(remote.name), 'releases'), { recursive: true })
      if (remote.images) {
        await writeFile(
          join(state, `remote-${target}.json`),
          JSON.stringify({ images: remote.images })
        )
      }
    }
    await options.setup?.(env)

    const input = {
      store: { container_project: 'app', ...options.store },
      release: options.release ?? R1,
      hosts: remotes.map((remote) => ({
        name: remote.name,
        ssh: `deploy@${remote.name}`,
        deployPath: env.deployPath(remote.name),
      })),
      tasks: options.tasks ?? ['oci:check', 'oci:build', 'deploy:release', 'oci:transfer'],
      rollback: options.rollback,
    }
    const result = await execa(process.execPath, [FIXTURE, JSON.stringify(input)], {
      cwd: projectDir,
      reject: false,
      env: {
        PATH: [join(root, 'local-bin'), shared, tools].join(delimiter),
        HOME: root,
        OCI_STATE: state,
        OCI_LOG: log,
        OCI_REMOTES: JSON.stringify(remoteEnv),
        FAKE_ARCH: process.arch === 'arm64' ? 'aarch64' : 'x86_64',
        ...options.env,
      },
    })

    const logContent = await readFile(log, 'utf8')
    const calls = logContent
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { side: string; bin: string; args: string[] })
    const images = async (side: string): Promise<Record<string, string>> => {
      const file = join(state, `${side === 'local' ? 'local' : `remote-deploy@${side}`}.json`)
      return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).images : {}
    }
    const manifestPath = (host: string, release = input.release) =>
      join(env.deployPath(host), 'releases', release, 'release.json')
    const manifest = async (host = remotes[0].name, release = input.release) => {
      const file = manifestPath(host, release)
      return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : null
    }
    return { ...result, calls, images, manifest, manifestPath, env }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

type Run = Awaited<ReturnType<typeof runOci>>

async function scenario(options: Scenario, check: (run: Run) => Promise<void> | void) {
  const run = await runOci(options)
  try {
    await check(run)
  } finally {
    await rm(run.env.root, { recursive: true, force: true })
  }
}

const calls = (run: Run, side: string, command: string) =>
  run.calls.filter((call) => call.side === side && call.args[0] === command)

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
