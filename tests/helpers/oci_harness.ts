/**
 * Test harness for the container recipes: runs tasks in a separate process against
 * fake servers. `ssh` runs remote commands locally with the PATH and architecture of
 * the targeted server, `docker`/`podman` are emulated (images, containers, compose)
 * and the PATH only exposes symlinked system tools, so real engines never interfere.
 */
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

export const R1 = '2026-11-25T10-00-00-000Z'
export const R2 = '2026-11-25T11-00-00-000Z'

const FIXTURE = fileURLToPath(new URL('../fixtures/run_oci.ts', import.meta.url))
const TOOLS = [
  'bash',
  'sh',
  'base64',
  'gzip',
  'zstd',
  'cat',
  'cp',
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
  'touch',
]

// State is kept per side ("local" or "remote-<ssh target>") in OCI_STATE; every call
// is logged to OCI_LOG. Container statuses come from OCI_CONTAINER_STATUS, keyed by
// "service@release" or "service": "state|status" values separated by ";" are
// returned on successive polls.
const ENGINE = `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const name = path.basename(process.argv[1])
const side = process.env.OCI_SIDE || 'local'
const [cmd, ...rest] = process.argv.slice(2)
const file = path.join(process.env.OCI_STATE, side + '.json')
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
state.images = state.images || {}
state.containers = state.containers || {}
const save = () => fs.writeFileSync(file, JSON.stringify(state))
const entry = { side, bin: name, args: [cmd, ...rest], cwd: process.cwd() }
let sub = ''
let subArgs = []
if (cmd === 'compose') {
  const compose = { project: '', files: [], profiles: [] }
  let i = 0
  while (i < rest.length && ['-p', '-f', '--profile'].includes(rest[i])) {
    if (rest[i] === '-p') compose.project = rest[i + 1]
    if (rest[i] === '-f') compose.files.push(rest[i + 1])
    if (rest[i] === '--profile') compose.profiles.push(rest[i + 1])
    i += 2
  }
  sub = rest[i]
  subArgs = rest.slice(i + 1)
  entry.compose = compose
  entry.args = ['compose', sub, ...subArgs]
}
fs.appendFileSync(process.env.OCI_LOG, JSON.stringify(entry) + '\\n')
const fail = (message) => { process.stderr.write(message + '\\n'); process.exit(1) }
const key = cmd === 'compose' ? 'compose-' + sub : cmd === 'run' && rest.includes('--rm') ? 'run-rm' : cmd
if ((process.env.OCI_FAIL || '').split(',').includes(side + ':' + key)) fail(key + ' failed')
const config = JSON.parse(process.env.OCI_COMPOSE_CONFIG || '{"services":{}}')
const statuses = JSON.parse(process.env.OCI_CONTAINER_STATUS || '{}')

if (cmd === 'compose') {
  // Like podman compose, whatever the provider: the banner mentions podman-compose(1).
  if (name === 'podman') process.stderr.write('\u001b[4m>>>> Executing external compose provider "/usr/bin/provider". Please see podman-compose(1) for how to disable this message. <<<<\\n\u001b[0m')
  switch (sub) {
    case 'version':
      if (process.env.OCI_COMPOSE_MISSING) fail('no compose provider')
      console.log(process.env.OCI_COMPOSE_VERSION || 'Docker Compose version v2.29.0')
      break
    case 'config':
      if (subArgs.includes('--services')) console.log(Object.keys(config.services).join('\\n'))
      else if (subArgs.includes('--format')) console.log(JSON.stringify(config))
      else console.log('name: ' + entry.compose.project)
      break
    case 'up': {
      const targets = subArgs.filter((arg) => !arg.startsWith('-'))
      for (const service of targets.length ? targets : Object.keys(config.services)) {
        state.containers[entry.compose.project + '-' + service + '-1'] = {
          labels: { 'com.docker.compose.project': entry.compose.project, 'com.docker.compose.service': service },
          release: path.basename(process.cwd()),
          polls: 0,
        }
      }
      save()
      break
    }
    case 'logs': console.log('web-1  | listening'); break
    case 'ps': console.log('NAME   STATUS'); break
  }
  process.exit(0)
}

switch (cmd) {
  case '--version': console.log(name + ' version 9.9.9'); break
  case 'info': console.log(process.env.OCI_STATE); break
  case 'build': {
    const ref = rest[rest.indexOf('-t') + 1]
    state.images[ref] = process.env.OCI_BUILD_ID || 'sha256:built'
    state.labels = state.labels || {}
    state.labels[ref] = rest[rest.indexOf('--label') + 1]
    save()
    break
  }
  case 'image': {
    const ref = rest.at(-1)
    if (!state.images[ref]) fail('no such image ' + ref)
    const format = rest[rest.indexOf('--format') + 1] || ''
    const config = process.env.OCI_IMAGE_CONFIG || '{"Cmd":["node"]}'
    if (format.includes('RootFS')) console.log(JSON.stringify([process.env.OCI_BUILD_CONTENT || 'layer-' + state.images[ref]]) + '\\n' + config)
    else if (format.includes('Healthcheck')) console.log(side !== 'local' && process.env.OCI_DROP_HEALTHCHECK ? 'null' : JSON.stringify(JSON.parse(config).Healthcheck || null))
    else console.log(state.images[ref])
    break
  }
  case 'save': { const ref = rest.at(-1); if (!state.images[ref]) fail('no such image'); process.stdout.write('ARCHIVE ' + ref + ' ' + state.images[ref] + '\\n' + 'x'.repeat(64 * 1024)); break }
  case 'load': { const data = fs.readFileSync(0, 'utf8'); const m = data.match(/^ARCHIVE (\\S+) (\\S+)\\n/); if (!m) fail('invalid archive'); state.images[m[1]] = m[2]; save(); console.log('Loaded image: ' + m[1]); break }
  case 'tag': if (!state.images[rest[0]]) fail('no such image'); state.images[rest[1]] = state.images[rest[0]]; save(); break
  case 'pull': state.images[rest[0]] = 'sha256:pulled'; save(); break
  case 'rmi': if ((process.env.OCI_IN_USE || '').split(',').includes(rest[0])) fail('image is in use'); delete state.images[rest[0]]; save(); break
  case 'images': {
    const label = rest.includes('--filter') ? rest[rest.indexOf('--filter') + 1].replace(/^label=/, '') : ''
    for (const ref of Object.keys(state.images)) {
      if (!ref.startsWith(rest.at(-1) + ':')) continue
      if (label && (state.labels || {})[ref] !== label) continue
      console.log(ref)
    }
    break
  }
  case 'ps': {
    const filters = []
    for (let i = 0; i < rest.length; i++) if (rest[i] === '--filter') filters.push(rest[i + 1].replace(/^label=/, ''))
    for (const [container, c] of Object.entries(state.containers)) {
      if (!filters.every((filter) => { const [k, v] = filter.split('='); return c.labels[k] === v })) continue
      const service = c.labels['com.docker.compose.service'] || c.labels['com.catapultjs.service']
      const spec = (statuses[service + '@' + c.release] || statuses[service] || 'running|Up 1 second').split(';')
      const [st, status] = spec[Math.min(c.polls, spec.length - 1)].split('|')
      c.polls++
      console.log(rest.join(' ').includes('.State') ? container + '\\t' + st + '\\t' + status : container)
    }
    save()
    break
  }
  case 'run': {
    const opts = { labels: {}, envFiles: [] }
    const valued = ['--name', '--network', '--restart', '--label', '--user', '--entrypoint', '--env-file', '-p', '-v']
    let i = 0
    while (i < rest.length && rest[i].startsWith('-')) {
      if (!valued.includes(rest[i])) { opts[rest[i]] = true; i++; continue }
      const value = rest[i + 1]
      if (rest[i] === '--label') opts.labels[value.slice(0, value.indexOf('='))] = value.slice(value.indexOf('=') + 1)
      else if (rest[i] === '--env-file') opts.envFiles.push(value)
      else opts[rest[i]] = value
      i += 2
    }
    if (!state.images[rest[i]]) fail('no such image ' + rest[i])
    for (const envFile of opts.envFiles) if (!fs.existsSync(envFile)) fail('env file not found ' + envFile)
    if (opts['--rm']) break
    if (state.containers[opts['--name']]) fail('name already in use ' + opts['--name'])
    state.containers[opts['--name']] = { labels: opts.labels, release: opts.labels['com.catapultjs.release'] || '', polls: 0 }
    save()
    break
  }
  case 'network': {
    state.networks = state.networks || {}
    if (rest[0] === 'inspect' && !state.networks[rest.at(-1)]) fail('no such network')
    if (rest[0] === 'create') { state.networks[rest.at(-1)] = true; save() }
    break
  }
  case 'stop': case 'start': case 'restart': if (!state.containers[rest.at(-1)]) fail('no such container ' + rest.at(-1)); break
  case 'rm': if (!state.containers[rest.at(-1)]) fail('no such container'); delete state.containers[rest.at(-1)]; save(); break
  case 'logs': console.log('log line'); break
  case 'container': {
    const restarting = (process.env.OCI_RESTARTING || '').split(',')
    for (const name of rest.slice(3)) {
      const c = state.containers[name]
      if (!c) fail('no such container ' + name)
      const service = c.labels['com.docker.compose.service'] || c.labels['com.catapultjs.service']
      console.log(restarting.includes(service) ? c.polls + ' t' + c.polls : '0 t0')
    }
    break
  }
  default: fail('unknown command ' + cmd)
}
`

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

const SCP = `#!${process.execPath}
const args = process.argv.slice(2)
require('node:fs').cpSync(args.at(-2), args.at(-1).replace(/^[^:]+:/, ''), { recursive: true })
`

const SYSTEMCTL = `#!/bin/sh
case "$*" in
  *is-active*podman.socket*) echo "\${FAKE_SOCKET:-active}"; [ "\${FAKE_SOCKET:-active}" = active ] ;;
  *is-enabled*podman-restart*) echo "\${FAKE_RESTART:-enabled}"; [ "\${FAKE_RESTART:-enabled}" = enabled ] ;;
  *) exit 1 ;;
esac
`

export interface Remote {
  name: string
  engines?: string[]
  arch?: string
  images?: Record<string, string>
  /** Existing containers by name: Compose labels of the "app" project unless labels are given. */
  containers?: Record<
    string,
    { service: string; release?: string; labels?: Record<string, string> }
  >
}

export interface OciEnv {
  root: string
  deployPath: (host: string) => string
  releasePath: (host: string, release: string) => string
}

export interface Scenario {
  recipe?: string
  deploy?: boolean
  store?: Record<string, unknown>
  release?: string
  remotes?: Remote[]
  localEngines?: string[]
  localImages?: Record<string, string>
  /** Local images built by another project (different project label). */
  otherProjectImages?: string[]
  /** Refs recorded in the server registry (.catapult/images) of each host before running. */
  registry?: string[]
  tasks?: string[]
  rollback?: { host: string; target: string }
  env?: Record<string, string>
  compose?: Record<string, unknown>
  statuses?: Record<string, string>
  files?: Record<string, string>
  git?: 'clean' | 'dirty'
  setup?: (env: OciEnv) => Promise<void>
}

export interface Call {
  side: string
  bin: string
  args: string[]
  cwd: string
  compose?: { project: string; files: string[]; profiles: string[] }
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
  const env: OciEnv = {
    root,
    deployPath: (host) => join(root, 'srv', host),
    releasePath: (host, release) => join(root, 'srv', host, 'releases', release),
  }

  try {
    await mkdir(projectDir)
    await mkdir(state)
    await writeFile(log, '')
    await linkTools(tools)
    await binDir(shared, [])
    const scripts: Record<string, string> = {
      ssh: SSH,
      scp: SCP,
      systemctl: SYSTEMCTL,
      uname: '#!/bin/sh\necho "${FAKE_ARCH:-x86_64}"\n',
      loginctl: '#!/bin/sh\necho "${FAKE_LINGER:-yes}"\n',
    }
    for (const [name, script] of Object.entries(scripts)) {
      await writeFile(join(shared, name), script, { mode: 0o755 })
    }
    await binDir(join(root, 'local-bin'), options.localEngines ?? ['podman'])
    await writeFile(join(projectDir, 'Containerfile'), 'FROM scratch\n')
    for (const [file, content] of Object.entries(options.files ?? {})) {
      await mkdir(dirname(join(projectDir, file)), { recursive: true })
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
      // Local images carry the project label of the "app" project unless listed in otherProjectImages.
      const labels = Object.fromEntries(
        Object.keys(options.localImages).map((ref) => [
          ref,
          options.otherProjectImages?.includes(ref)
            ? 'com.catapultjs.project=other'
            : 'com.catapultjs.project=app',
        ])
      )
      await writeFile(
        join(state, 'local.json'),
        JSON.stringify({ images: options.localImages, labels })
      )
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
      await mkdir(join(env.deployPath(remote.name), '.catapult'), { recursive: true })
      if (options.registry) {
        await writeFile(
          join(env.deployPath(remote.name), '.catapult', 'images'),
          options.registry.map((ref) => `${ref}\n`).join('')
        )
      }
      if (remote.images || remote.containers) {
        const containers = Object.fromEntries(
          Object.entries(remote.containers ?? {}).map(([name, container]) => [
            name,
            {
              labels: container.labels ?? {
                'com.docker.compose.project': 'app',
                'com.docker.compose.service': container.service,
              },
              release: container.release ?? 'old',
              polls: 0,
            },
          ])
        )
        await writeFile(
          join(state, `remote-${target}.json`),
          JSON.stringify({ images: remote.images ?? {}, containers })
        )
      }
    }
    await options.setup?.(env)

    const input = {
      recipe: options.recipe,
      deploy: options.deploy,
      store: { container_project: 'app', ...options.store },
      release: options.release ?? R1,
      hosts: remotes.map((remote) => ({
        name: remote.name,
        ssh: `deploy@${remote.name}`,
        deployPath: env.deployPath(remote.name),
      })),
      tasks:
        options.tasks ??
        (options.deploy ? [] : ['oci:check', 'oci:build', 'deploy:release', 'oci:transfer']),
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
        OCI_COMPOSE_CONFIG: JSON.stringify(options.compose ?? { services: {} }),
        OCI_CONTAINER_STATUS: JSON.stringify(options.statuses ?? {}),
        FAKE_ARCH: process.arch === 'arm64' ? 'aarch64' : 'x86_64',
        ...options.env,
      },
    })

    const logContent = await readFile(log, 'utf8')
    const calls = logContent
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Call)
    const images = async (side: string): Promise<Record<string, string>> => {
      const file = join(state, `${side === 'local' ? 'local' : `remote-deploy@${side}`}.json`)
      if (!existsSync(file)) return {}
      const content = await readFile(file, 'utf8')
      return JSON.parse(content).images
    }
    const manifestPath = (host: string, release = input.release) =>
      join(env.releasePath(host, release), 'release.json')
    const manifest = async (host = remotes[0].name, release = input.release) => {
      const file = manifestPath(host, release)
      if (!existsSync(file)) return null
      const content = await readFile(file, 'utf8')
      return JSON.parse(content)
    }
    return { ...result, calls, images, manifest, manifestPath, env }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

export type Run = Awaited<ReturnType<typeof runOci>>

export async function scenario(options: Scenario, check: (run: Run) => Promise<void> | void) {
  const run = await runOci(options)
  try {
    await check(run)
  } finally {
    await rm(run.env.root, { recursive: true, force: true })
  }
}

/** Engine calls for a side ("local" or "remote-deploy@<host>") and a command. */
export const calls = (run: Run, side: string, command: string) =>
  run.calls.filter((call) => call.side === side && call.args[0] === command)

/** Compose subcommand calls on a host. */
export const composeCalls = (run: Run, host: string, subcommand?: string) =>
  run.calls.filter(
    (call) =>
      call.side === `remote-deploy@${host}` &&
      call.args[0] === 'compose' &&
      (!subcommand || call.args[1] === subcommand)
  )
