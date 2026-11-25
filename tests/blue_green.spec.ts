import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readlink, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type OciEnv, type Run, R1, R2, scenario } from './helpers/oci_harness.ts'

const BG = { ports: [13011, 13012], container_port: 3333, health_path: '/health', drain: 0 }
const SERVICES = {
  web: { command: ['node', 'server.js'], blue_green: BG },
  worker: { command: ['node', 'worker.js'] },
}
const STORE = { container_services: SERVICES, container_caddy_upstreams: '$ROOT/caddy' }
const CATAPULT = (service: string, release: string, slot?: string) => ({
  'com.catapultjs.project': 'app',
  'com.catapultjs.service': service,
  'com.catapultjs.release': release,
  ...(slot ? { 'com.catapultjs.slot': slot } : {}),
})

const upstream = (env: OciEnv) => join(env.root, 'caddy', 'app-web.caddy')

/**
 * Engine, Caddy and curl calls on the server, in order, without the defensive removal
 * that precedes each start.
 */
function timeline(run: Run): string[] {
  const entries = run.calls
    .filter((call) => call.side === 'remote-deploy@web')
    .filter((call) => ['caddy', 'curl'].includes(call.bin) || ['run', 'rm'].includes(call.args[0]))
    .map((call) => {
      if (call.bin === 'caddy') return `caddy ${call.args[0]}`
      if (call.bin === 'curl') return `curl ${call.args[0]}`
      if (call.args[0] === 'run') return `run ${call.args[call.args.indexOf('--name') + 1]}`
      return `rm ${call.args.at(-1)}`
    })
  return entries.filter(
    (entry, index) => !(entry.startsWith('rm ') && entries[index + 1] === `run ${entry.slice(3)}`)
  )
}

async function containers(run: Run): Promise<string[]> {
  const content = await readFile(join(run.env.root, 'state', 'remote-deploy@web.json'), 'utf8')
  return Object.keys(JSON.parse(content).containers).sort()
}

/** R1 deployed and live in slot a: manifest, current link and upstream file. */
async function liveRelease(env: OciEnv) {
  const release = env.releasePath('web', R1)
  await mkdir(release, { recursive: true })
  const spec = {
    command: ['node', 'old.js'],
    entrypoint: null,
    user: null,
    envFiles: [],
    envKeys: [],
    ports: [],
    volumes: [],
    restart: 'always',
    labels: {},
    blueGreen: { ports: [13011, 13012], containerPort: 3333, healthPath: '/health', drain: 0 },
  }
  await writeFile(
    join(release, 'release.json'),
    JSON.stringify({
      schemaVersion: 1,
      images: [{ ref: `localhost/app:${R1}`, localId: 'sha256:old', remoteId: 'sha256:old' }],
      container: { network: 'app', services: { web: spec } },
    })
  )
  await symlink(release, join(env.deployPath('web'), 'current'))
  await mkdir(join(env.root, 'caddy'), { recursive: true })
  await writeFile(upstream(env), 'to 127.0.0.1:13011\n')
}

const LIVE = {
  release: R2,
  remotes: [
    {
      name: 'web',
      images: { [`localhost/app:${R1}`]: 'sha256:old' },
      containers: {
        'app-web-a': { service: 'web', release: R1, labels: CATAPULT('web', R1, 'a') },
      },
    },
  ],
  setup: liveRelease,
}

test.group('container — blue/green', () => {
  test('starts the release in the idle slot, checks it, then switches Caddy', async ({
    assert,
  }) => {
    await scenario(
      {
        recipe: 'container',
        deploy: true,
        store: STORE,
        remotes: [
          {
            name: 'web',
            // Started before blue/green was enabled: removed first, it may hold a port.
            containers: { 'app-web': { service: 'web', labels: CATAPULT('web', 'old') } },
          },
        ],
      },
      async (run) => {
        assert.equal(run.exitCode, 0, run.stderr)
        const web = run.calls.find(
          (call) => call.args[0] === 'run' && call.args.includes('app-web-a')
        )!
        assert.includeMembers(web.args, [
          '-p',
          '127.0.0.1:13011:3333',
          '--label',
          'com.catapultjs.slot=a',
        ])
        assert.deepEqual(timeline(run), [
          'rm app-web',
          'run app-web-a',
          'run app-worker',
          'curl http://127.0.0.1:13011/health',
          'caddy validate',
          'caddy reload',
        ])
        assert.equal(await readFile(upstream(run.env), 'utf8'), 'to 127.0.0.1:13011\n')
        assert.isFalse(existsSync(`${upstream(run.env)}.prev`))
      }
    )
  }).timeout(60_000)

  test('retires the previous slot after the healthcheck', async ({ assert }) => {
    await scenario({ recipe: 'container', deploy: true, store: STORE, ...LIVE }, async (run) => {
      assert.equal(run.exitCode, 0, run.stderr)
      assert.deepEqual(timeline(run), [
        'run app-web-b',
        'run app-worker',
        'curl http://127.0.0.1:13012/health',
        'caddy validate',
        'caddy reload',
        'rm app-web-a',
      ])
      assert.equal(await readFile(upstream(run.env), 'utf8'), 'to 127.0.0.1:13012\n')
      assert.deepEqual(await containers(run), ['app-web-b', 'app-worker'])
    })
  }).timeout(60_000)

  test('switches back to the running slot when the new one fails', async ({ assert }) => {
    await scenario(
      {
        recipe: 'container',
        deploy: true,
        store: { ...STORE, container_wait_timeout: 1 },
        env: { FAKE_CURL_FAIL: '13012' },
        ...LIVE,
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'web did not answer http://127.0.0.1:13012/health')
        assert.include(run.stdout, 'auto rollback OK')
        // The live container is never restarted: the rollback only points Caddy to it.
        assert.notInclude(timeline(run), 'run app-web-a')
        assert.notInclude(timeline(run), 'rm app-web-a')
        assert.equal(await readFile(upstream(run.env), 'utf8'), 'to 127.0.0.1:13011\n')
        // R1 has no worker: the rollback removes the one started by R2.
        assert.deepEqual(await containers(run), ['app-web-a'])
        const link = await readlink(join(run.env.deployPath('web'), 'current'))
        assert.equal(link, run.env.releasePath('web', R1))
      }
    )
  }).timeout(60_000)

  test('restores the upstream when Caddy rejects the configuration', async ({ assert }) => {
    await scenario(
      {
        recipe: 'container',
        deploy: true,
        store: STORE,
        env: { FAKE_CADDY_INVALID: '1' },
        ...LIVE,
      },
      async (run) => {
        assert.equal(run.exitCode, 1)
        assert.include(run.stderr, 'Caddy switch failed, previous upstreams restored')
        assert.include(run.stderr, 'unknown directive')
        assert.equal(await readFile(upstream(run.env), 'utf8'), 'to 127.0.0.1:13011\n')
        assert.notInclude(timeline(run), 'caddy reload')
      }
    )
  }).timeout(60_000)

  test('validates the blue/green configuration', async ({ assert }) => {
    const web = (extra: Record<string, unknown>) => ({
      container_services: { web: { blue_green: BG, ...extra } },
    })
    const cases: [Record<string, unknown>, string][] = [
      [web({ ports: ['127.0.0.1:3333:3333'] }), 'ports cannot be used with blue_green'],
      [web({ blue_green: { ...BG, ports: [13011, 13011] } }), 'must be two different ports'],
      [web({ blue_green: { ...BG, ports: [13011] } }), 'ports must list two host ports'],
      [web({ blue_green: { ...BG, health_path: 'health' } }), 'must be a path starting with /'],
      [web({ blue_green: { ports: [1, 2] } }), 'container_port must be a port number'],
      [
        {
          container_services: {
            web: { blue_green: BG },
            api: { blue_green: { ...BG, ports: [13012, 13013] } },
          },
        },
        'blue_green ports must be unique across services',
      ],
    ]
    for (const [store, message] of cases) {
      await scenario({ recipe: 'container', deploy: true, store }, (run) => {
        assert.equal(run.exitCode, 1, message)
        assert.include(run.stderr, message)
      })
    }
  }).timeout(120_000)
})
