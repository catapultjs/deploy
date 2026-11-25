/**
 * TYPE: container
 * DESCRIPTION:
 * Runs one or more containers from the release image with Docker or Podman, without
 * Compose. The image is built locally, streamed over SSH (no registry), and each
 * release records how its containers were started so a rollback replays it exactly.
 */
import type {} from '../src/types.ts'
import { posix } from 'node:path'
import {
  type TaskContext,
  task,
  desc,
  get,
  set,
  initPipeline,
  onStatus,
  onBeforeRollback,
  onRollback,
} from '../index.ts'
import type { Host } from '../src/types.ts'
import type { CatapultLogger } from '../src/logger.ts'
import { Verbose } from '../src/enums.ts'
import { getPaths, q, ssh } from '../src/utils.ts'
import './deploy/lock.ts'
import './deploy/release.ts'
import './deploy/shared.ts'
import './deploy/publish.ts'
import './deploy/log_revision.ts'
import './deploy/healthcheck.ts'
import './deploy/cleanup.ts'
import './oci/index.ts'
import { project, releaseRef } from './oci/config.ts'
import { type RemoteFacts, checkPodmanRestart, hostFacts } from './oci/engine.ts'
import { readManifest, setManifestExtra } from './oci/manifest.ts'
import { listContainers, waitReady } from './oci/readiness.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'container:check': true
    'container:prepare': true
    'container:migrate': true
    'container:up': true
    'container:start': true
    'container:stop': true
    'container:restart': true
    'container:remove': true
    'container:logs': true
    'container:status': true
  }
}

set('oci_recipe', 'container')

const LABEL_PROJECT = 'com.catapultjs.project'
const LABEL_SERVICE = 'com.catapultjs.service'
const LABEL_RELEASE = 'com.catapultjs.release'
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const RESTART_PATTERN = /^(no|always|unless-stopped|on-failure(:\d+)?)$/
const LABEL_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/
const ENV_DIR = 'container'

/** Options of a service in `container_services`. */
export interface ServiceConfig {
  command?: string[]
  /** Runs an init process as PID 1 that forwards signals and reaps zombies. */
  init?: boolean
  entrypoint?: string
  user?: string
  env?: Record<string, string>
  env_file?: string[]
  ports?: string[]
  volumes?: string[]
  restart?: string
  labels?: Record<string, string>
}

/**
 * How a service is started for a release, recorded in its manifest. Environment
 * values are not recorded: they live in env files of the release directory.
 */
interface ServiceSpec {
  command: string[] | null
  init?: boolean
  entrypoint: string | null
  user: string | null
  envFiles: string[]
  envKeys: string[]
  ports: string[]
  volumes: string[]
  restart: string
  labels: Record<string, string>
}

interface ContainerData {
  network: string
  services: Record<string, ServiceSpec>
}

interface Stack {
  host: Host
  facts: RemoteFacts
  release: string
  path: string
  data: ContainerData
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function fail(message: string): never {
  throw new Error(message)
}

function plain(key: string, value: unknown): string {
  if (typeof value !== 'string' || /[\r\n\0]/.test(value)) {
    fail(`${key} must be a single-line string`)
  }
  return value
}

function option(key: string, value: unknown): string {
  const text = plain(key, value)
  if (!text.trim() || /\s/.test(text) || text.startsWith('-')) {
    fail(`${key} must be a non-empty value without spaces`)
  }
  return text
}

function strings(key: string, value: unknown, check = option): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail(`${key} must be an array`)
  return value.map((item, index) => check(`${key}[${index}]`, item))
}

function record(key: string, value: unknown, keyPattern: RegExp): Record<string, string> {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${key} must be an object`)
  return Object.fromEntries(
    Object.entries(value).map(([name, item]) => {
      if (!keyPattern.test(name)) fail(`${key} has an invalid name: ${name}`)
      return [name, plain(`${key}.${name}`, item)]
    })
  )
}

/** Resolves a path relative to the release directory, refusing to leave it. */
function releasePath(key: string, releaseDir: string, value: string): string {
  if (posix.isAbsolute(value)) return value
  const normalized = posix.normalize(value)
  if (normalized === '..' || normalized.startsWith('../')) {
    fail(`${key} must stay inside the release directory: ${value}`)
  }
  return posix.join(releaseDir, normalized)
}

/** `./dir:/path`, `/abs:/path[:ro]` or `named:/path`; relative sources resolve in the release. */
function volume(key: string, releaseDir: string, value: string): string {
  const parts = value.split(':')
  if (parts.length < 2 || parts.length > 3 || !parts[1].startsWith('/')) {
    fail(`${key} must look like source:/container/path[:options]`)
  }
  const [source, ...rest] = parts
  let resolved = source
  if (source.startsWith('.')) resolved = releasePath(key, releaseDir, source)
  else if (!source.startsWith('/') && !NAME_PATTERN.test(source)) {
    fail(`${key} has an invalid volume name: ${source}`)
  }
  return [resolved, ...rest].join(':')
}

export function serviceConfigs(): Record<string, ServiceConfig> {
  const value = get<unknown>('container_services')
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
    fail('container_services must define at least one service')
  }
  for (const name of Object.keys(value)) {
    if (!NAME_PATTERN.test(name)) fail(`container_services has an invalid service name: ${name}`)
  }
  return value as Record<string, ServiceConfig>
}

function specs(releaseDir: string): { data: ContainerData; envFiles: Record<string, string> } {
  const services: Record<string, ServiceSpec> = {}
  const envFiles: Record<string, string> = {}

  for (const [name, config] of Object.entries(serviceConfigs())) {
    const key = `container_services.${name}`
    if (!config || typeof config !== 'object') fail(`${key} must be an object`)
    const env = record(`${key}.env`, config.env, ENV_KEY_PATTERN)
    const labels = record(`${key}.labels`, config.labels, LABEL_KEY_PATTERN)
    if (Object.keys(labels).some((label) => label.startsWith('com.catapultjs.'))) {
      fail(`${key}.labels must not use the com.catapultjs. prefix`)
    }
    const restart =
      config.restart === undefined ? 'always' : plain(`${key}.restart`, config.restart)
    if (!RESTART_PATTERN.test(restart)) {
      fail(`${key}.restart must be no, always, unless-stopped or on-failure[:N]`)
    }

    const files = strings(`${key}.env_file`, config.env_file).map((file) =>
      releasePath(`${key}.env_file`, releaseDir, file)
    )
    if (Object.keys(env).length) {
      const generated = `${releaseDir}/${ENV_DIR}/${name}.env`
      envFiles[generated] = Object.entries(env)
        .map(([envKey, envValue]) => `${envKey}=${envValue}\n`)
        .join('')
      files.unshift(generated)
    }

    if (config.init !== undefined && typeof config.init !== 'boolean') {
      fail(`${key}.init must be a boolean`)
    }
    services[name] = {
      init: config.init ?? false,
      command:
        config.command === undefined ? null : strings(`${key}.command`, config.command, plain),
      entrypoint:
        config.entrypoint === undefined ? null : option(`${key}.entrypoint`, config.entrypoint),
      user: config.user === undefined ? null : option(`${key}.user`, config.user),
      envFiles: files,
      envKeys: Object.keys(env),
      ports: strings(`${key}.ports`, config.ports),
      volumes: strings(`${key}.volumes`, config.volumes, plain).map((item) =>
        volume(`${key}.volumes`, releaseDir, item)
      ),
      restart,
      labels,
    }
    if (services[name].command?.length === 0) fail(`${key}.command must not be empty`)
  }

  return { data: { network: project(), services }, envFiles }
}

function migration(): { service: string; command: string[] } | undefined {
  const value = get<{ service: string; command: string[] } | undefined>('container_migrate')
  if (value === undefined) return undefined
  if (
    !value ||
    typeof value.service !== 'string' ||
    !Array.isArray(value.command) ||
    !value.command.length ||
    value.command.some((arg) => typeof arg !== 'string')
  ) {
    fail('container_migrate must be { service: string, command: string[] }')
  }
  return value
}

function seconds(key: string, fallback: number): number {
  const value = Number(get<number>(key, fallback))
  if (!Number.isFinite(value) || value <= 0) fail(`${key} must be a positive number of seconds`)
  return value
}

function logLines(): number {
  const value = Number(get<number>('container_logs_lines', 100))
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 100
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function containerName(service: string): string {
  return `${project()}-${service}`
}

function runArgs(stack: Stack, service: string, oneOff?: string[]): string[] {
  const spec = stack.data.services[service]
  const args = oneOff
    ? ['--rm', '--network', stack.data.network, '--label', 'com.catapultjs.oneoff=true']
    : ['-d', '--name', containerName(service), '--network', stack.data.network]
  if (!oneOff) args.push('--restart', spec.restart, '--label', `${LABEL_SERVICE}=${service}`)
  args.push(
    '--label',
    `${LABEL_PROJECT}=${project()}`,
    '--label',
    `${LABEL_RELEASE}=${stack.release}`
  )
  // User labels (e.g. reverse proxy routing) only apply to service containers.
  if (!oneOff) {
    for (const [label, value] of Object.entries(spec.labels)) {
      args.push('--label', `${label}=${value}`)
    }
  }
  if (spec.init) args.push('--init')
  if (spec.user) args.push('--user', spec.user)
  if (spec.entrypoint) args.push('--entrypoint', spec.entrypoint)
  for (const file of spec.envFiles) args.push('--env-file', file)
  if (!oneOff) for (const port of spec.ports) args.push('-p', port)
  for (const mount of spec.volumes) args.push('-v', mount)
  args.push(releaseRef(stack.release), ...(oneOff ?? spec.command ?? []))
  return args
}

function engine(stack: Stack, args: string[]): string {
  return `${q(stack.facts.bin)} ${args.map(q).join(' ')}`
}

function ensureNetwork(stack: Stack): string {
  const { network } = stack.data
  return `${engine(stack, ['network', 'inspect', network])} >/dev/null 2>&1 || ${engine(stack, ['network', 'create', '--label', `${LABEL_PROJECT}=${project()}`, network])} >/dev/null`
}

function stopAndRemove(stack: Stack, name: string): string[] {
  const timeout = String(seconds('container_stop_timeout', 10))
  return [
    `${engine(stack, ['stop', '-t', timeout, name])} >/dev/null 2>&1 || true`,
    `${engine(stack, ['rm', name])} >/dev/null 2>&1 || true`,
  ]
}

function verbosity(ctx: { config: TaskContext['config'] }): number {
  return ctx.config.verbose ?? Verbose.SILENT
}

const stacks = new Map<string, ContainerData>()

/** Container configuration of a release: from this deployment, else from its manifest. */
async function loadStack(
  host: Host,
  logger: CatapultLogger,
  release: string,
  path: string
): Promise<Stack> {
  const facts = await hostFacts(host, logger)
  let data = stacks.get(`${host.name}|${release}`)
  if (!data) {
    const manifest = await readManifest(host, path)
    data = manifest?.container as ContainerData | undefined
  }
  if (!data?.services) {
    throw new Error(`[${host.name}] release ${release} has no container configuration`)
  }
  return { host, facts, release, path, data }
}

function filters(stack: Stack, withRelease = false): string[][] {
  return Object.keys(stack.data.services).map((service) => [
    `${LABEL_PROJECT}=${project()}`,
    `${LABEL_SERVICE}=${service}`,
    ...(withRelease ? [`${LABEL_RELEASE}=${stack.release}`] : []),
  ])
}

async function wait(stack: Stack, logger: CatapultLogger, verbose: number, withRelease = false) {
  await waitReady({
    host: stack.host,
    facts: stack.facts,
    filterSets: filters(stack, withRelease),
    timeoutSeconds: seconds('container_wait_timeout', 60),
    logger,
    verbose,
    logsTask: 'container:logs',
  })
}

/**
 * Replaces the containers of every service with the ones of the release, removes
 * containers of services no longer configured, then waits until they are ready.
 * Ports are released between stop and start: expect a short interruption.
 */
async function up(stack: Stack, logger: CatapultLogger, verbose: number) {
  const expected = new Set(Object.keys(stack.data.services).map(containerName))
  const existing = await listContainers(stack.host, stack.facts, [
    [`${LABEL_PROJECT}=${project()}`],
  ])
  const removed = existing.map((c) => c.name).filter((name) => !expected.has(name))

  const script = ['set -e', ensureNetwork(stack)]
  for (const service of Object.keys(stack.data.services)) {
    script.push(
      ...stopAndRemove(stack, containerName(service)),
      `${engine(stack, ['run', ...runArgs(stack, service)])} >/dev/null`
    )
  }
  for (const name of removed) script.push(...stopAndRemove(stack, name))

  if (verbose >= Verbose.NORMAL) {
    logger.step(stack.host.name, `start ${[...expected].join(', ')}`)
    if (removed.length) logger.step(stack.host.name, `remove ${removed.join(', ')}`)
  }
  await ssh(stack.host, script.join('\n'))
  await wait(stack, logger, verbose, true)
}

function names(stack: Stack): string[] {
  return Object.keys(stack.data.services).map(containerName)
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

onStatus(async (_ctx, host, logger) => {
  try {
    const facts = await hostFacts(host, logger)
    const data: Record<string, string> = {}
    for (const container of await listContainers(host, facts, [
      [`${LABEL_PROJECT}=${project()}`],
    ])) {
      data[`container:${container.name}`] = container.status || container.state
    }
    return data
  } catch {
    return { container: 'unavailable' }
  }
})

onBeforeRollback(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  const target = await loadStack(host, logger, ctx.release, paths.release)
  const files = Object.values(target.data.services).flatMap((spec) => spec.envFiles)
  if (!files.length) return
  try {
    await ssh(host, `set -e\n${files.map((file) => `[ -f ${q(file)} ]`).join('\n')}`)
  } catch {
    throw new Error(`[${host.name}] release ${ctx.release} is missing env files`)
  }
})

onRollback(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  const target = await loadStack(host, logger, ctx.release, paths.release)
  await up(target, logger, ctx.config.verbose ?? Verbose.SILENT)
})

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

desc('Checks the container configuration and the restart service')
task('container:check', async ({ host, logger }: TaskContext) => {
  serviceConfigs()
  migration()
  await checkPodmanRestart(host, await hostFacts(host, logger), logger)
})

desc('Writes the env files of the release and records how its containers start')
task('container:prepare', async ({ host, release, paths }: TaskContext) => {
  const { data, envFiles } = specs(paths.release)
  const job = migration()
  if (job && !data.services[job.service]) {
    fail(`container_migrate.service must be one of: ${Object.keys(data.services).join(', ')}`)
  }

  const userFiles = Object.values(data.services)
    .flatMap((spec) => spec.envFiles)
    .filter((file) => !(file in envFiles))
  const script = ['set -e', 'umask 077', `mkdir -p ${q(`${paths.release}/${ENV_DIR}`)}`]
  for (const [file, content] of Object.entries(envFiles)) {
    script.push(`printf '%s' ${q(content)} > ${q(file)}`)
  }
  for (const file of new Set(userFiles)) {
    script.push(`[ -f ${q(file)} ] || { echo ${q(`env_file not found: ${file}`)} >&2; exit 1; }`)
  }
  await ssh(host, script.join('\n'))

  stacks.set(`${host.name}|${release}`, data)
  setManifestExtra(host.name, release, 'container', data)
})

desc('Runs container_migrate in a one-off container of the new release, before publication')
task('container:migrate', async (ctx: TaskContext) => {
  const job = migration()
  if (!job) return
  const { host, logger, release, paths } = ctx
  const target = await loadStack(host, logger, release, paths.release)
  if (verbosity(ctx) >= Verbose.NORMAL) {
    logger.step(host.name, `migrate: ${job.service} ${job.command.join(' ')}`)
  }
  const { stdout } = await ssh(
    host,
    `set -e\n${ensureNetwork(target)}\n${engine(target, ['run', ...runArgs(target, job.service, job.command)])}`
  )
  if (verbosity(ctx) >= Verbose.NORMAL && stdout.trim()) logger.log(stdout.trim())
})

desc('Replaces the containers with the ones of the release and waits until they are ready')
task('container:up', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  await up(target, ctx.logger, verbosity(ctx))
})

desc('Starts the existing containers')
task('container:start', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  await ssh(ctx.host, `set -e\n${engine(target, ['start', ...names(target)])} >/dev/null`)
  await wait(target, ctx.logger, verbosity(ctx))
})

desc('Stops the containers')
task('container:stop', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await loadStack(host, logger, release, paths.release)
  const timeout = String(seconds('container_stop_timeout', 10))
  await ssh(host, `set -e\n${engine(target, ['stop', '-t', timeout, ...names(target)])} >/dev/null`)
})

desc('Restarts the containers and waits until they are ready')
task('container:restart', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  const timeout = String(seconds('container_stop_timeout', 10))
  await ssh(
    ctx.host,
    `set -e\n${engine(target, ['restart', '-t', timeout, ...names(target)])} >/dev/null`
  )
  await wait(target, ctx.logger, verbosity(ctx))
})

desc('Stops and removes the containers (volumes and network are kept)')
task('container:remove', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await loadStack(host, logger, release, paths.release)
  await ssh(
    host,
    ['set -e', ...names(target).flatMap((name) => stopAndRemove(target, name))].join('\n')
  )
})

desc('Displays the logs of the containers')
task('container:logs', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await loadStack(host, logger, release, paths.release)
  const script = names(target).map(
    (name) =>
      `echo ${q(`== ${name}`)}\n${engine(target, ['logs', '--tail', String(logLines()), name])} 2>&1 || true`
  )
  const { stdout } = await ssh(host, `set +e\n${script.join('\n')}`)
  logger.log(stdout.trim())
})

desc('Displays the containers of the project')
task('container:status', async ({ host, logger }: TaskContext) => {
  const facts = await hostFacts(host, logger)
  const { stdout } = await ssh(
    host,
    `set -e\n${q(facts.bin)} ps -a --filter ${q(`label=${LABEL_PROJECT}=${project()}`)} --format '{{.Names}}\t{{.Status}}\t{{.Image}}'`
  )
  logger.log(stdout.trim())
})

initPipeline([
  'deploy:lock',
  'oci:check',
  'container:check',
  'deploy:release',
  'deploy:shared',
  'container:prepare',
  'oci:build',
  'oci:transfer',
  'container:migrate',
  'deploy:publish',
  'container:up',
  'deploy:log_revision',
  'deploy:healthcheck',
  'deploy:cleanup',
  'oci:cleanup',
  'deploy:unlock',
])
