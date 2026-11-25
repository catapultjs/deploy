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
import { getPaths, q, sleep, ssh } from '../src/utils.ts'
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
import { exitCodeOf, failureOutput } from './oci/output.ts'
import { listContainers, waitReady } from './oci/readiness.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'container:check': true
    'container:prepare': true
    'container:migrate': true
    'container:up': true
    'container:retire': true
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
const LABEL_SLOT = 'com.catapultjs.slot'
const SLOTS = ['a', 'b'] as const
type Slot = (typeof SLOTS)[number]
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const RESTART_PATTERN = /^(no|always|unless-stopped|on-failure(:\d+)?)$/
const LABEL_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/
const DURATION_PATTERN = /^(\d+(ns|us|ms|s|m|h))+$/
const MEMORY_PATTERN = /^\d+(\.\d+)?[bkmg]?$/i
/** Options managed by the recipe, refused in `options`. */
const MANAGED_OPTIONS = ['--name', '--network', '--net', '--restart', '--rm', '-d', '--detach']
const ENV_DIR = 'container'

/** Options of a service in `container_services`. */
export interface ServiceConfig {
  command?: string[]
  /** Runs an init process as PID 1 that forwards signals and reaps zombies. */
  init?: boolean
  /**
   * `false` disables the image HEALTHCHECK (e.g. a worker sharing the web image); an
   * object replaces it, which also works where Podman drops the image healthcheck.
   */
  healthcheck?: boolean | HealthcheckConfig
  entrypoint?: string
  user?: string
  env?: Record<string, string>
  env_file?: string[]
  ports?: string[]
  volumes?: string[]
  restart?: string
  labels?: Record<string, string>
  /** Memory limit, e.g. `512m`. */
  memory?: string
  /** CPU limit, e.g. `1.5`. */
  cpus?: number | string
  /** Existing networks joined in addition to the project network. */
  networks?: string[]
  /** Raw engine options, e.g. `--cap-add=NET_ADMIN`. */
  options?: string[]
  /** Zero downtime deployment behind Caddy, alternating between two host ports. */
  blue_green?: BlueGreenConfig
}

export interface BlueGreenConfig {
  /** Host ports used alternately, published on 127.0.0.1. */
  ports: [number, number]
  /** Port the application listens on inside the container. */
  container_port: number
  /** Path requested on the new container before switching, e.g. `/health`. */
  health_path?: string
  /** Seconds left to the previous container to finish its requests (default 10). */
  drain?: number
}

/** Healthcheck run inside the container: `cmd` is a shell command. */
export interface HealthcheckConfig {
  cmd: string
  interval?: string
  timeout?: string
  retries?: number
  start_period?: string
}

/**
 * How a service is started for a release, recorded in its manifest. Environment
 * values are not recorded: they live in env files of the release directory.
 */
interface ServiceSpec {
  command: string[] | null
  init?: boolean
  healthcheck?: boolean | HealthcheckConfig
  entrypoint: string | null
  user: string | null
  envFiles: string[]
  envKeys: string[]
  ports: string[]
  volumes: string[]
  restart: string
  labels: Record<string, string>
  // Optional: absent from manifests written before these options existed.
  memory?: string | null
  cpus?: string | null
  networks?: string[]
  options?: string[]
  blueGreen?: BlueGreenSpec | null
}

interface BlueGreenSpec {
  ports: [number, number]
  containerPort: number
  healthPath: string | null
  drain: number
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

function healthcheck(key: string, value: unknown): boolean | HealthcheckConfig {
  if (value === undefined) return true
  if (typeof value === 'boolean') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${key} must be a boolean or { cmd, interval?, timeout?, retries?, start_period? }`)
  }
  const config = value as Record<string, unknown>
  const unknown = Object.keys(config).filter(
    (name) => !['cmd', 'interval', 'timeout', 'retries', 'start_period'].includes(name)
  )
  if (unknown.length) fail(`${key} has unknown options: ${unknown.join(', ')}`)
  const cmd = plain(`${key}.cmd`, config.cmd)
  if (!cmd.trim()) fail(`${key}.cmd must not be empty`)
  const result: HealthcheckConfig = { cmd }
  for (const name of ['interval', 'timeout', 'start_period'] as const) {
    if (config[name] === undefined) continue
    const duration = plain(`${key}.${name}`, config[name])
    if (!DURATION_PATTERN.test(duration))
      fail(`${key}.${name} must be a duration such as 30s or 1m30s`)
    result[name] = duration
  }
  if (config.retries !== undefined) {
    if (!Number.isInteger(config.retries) || (config.retries as number) < 1) {
      fail(`${key}.retries must be a positive integer`)
    }
    result.retries = config.retries as number
  }
  return result
}

function cpus(key: string, value: unknown): string | null {
  if (value === undefined) return null
  const text = typeof value === 'number' ? String(value) : plain(key, value)
  if (!/^\d+(\.\d+)?$/.test(text) || Number(text) <= 0) fail(`${key} must be a positive number`)
  return text
}

function engineOptions(key: string, value: unknown): string[] {
  const options = strings(key, value, plain)
  for (const item of options) {
    const flag = item.split('=')[0]
    if (MANAGED_OPTIONS.includes(flag)) {
      fail(`${key} must not set ${flag}: it is managed by the recipe`)
    }
  }
  return options
}

function portNumber(key: string, value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65535) {
    fail(`${key} must be a port number`)
  }
  return value as number
}

function blueGreen(key: string, value: unknown): BlueGreenSpec | null {
  if (value === undefined) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${key} must be { ports, container_port, health_path?, drain? }`)
  }
  const config = value as Record<string, unknown>
  if (!Array.isArray(config.ports) || config.ports.length !== 2) {
    fail(`${key}.ports must list two host ports`)
  }
  const ports = config.ports.map((item, index) => portNumber(`${key}.ports[${index}]`, item))
  if (ports[0] === ports[1]) fail(`${key}.ports must be two different ports`)
  let healthPath: string | null = null
  if (config.health_path !== undefined) {
    healthPath = plain(`${key}.health_path`, config.health_path)
    if (!healthPath.startsWith('/') || /\s/.test(healthPath)) {
      fail(`${key}.health_path must be a path starting with /`)
    }
  }
  const drain = config.drain === undefined ? 10 : Number(config.drain)
  if (!Number.isFinite(drain) || drain < 0) fail(`${key}.drain must be a number of seconds`)
  return {
    ports: [ports[0], ports[1]],
    containerPort: portNumber(`${key}.container_port`, config.container_port),
    healthPath,
    drain,
  }
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
    const memory = config.memory === undefined ? null : plain(`${key}.memory`, config.memory)
    if (memory !== null && !MEMORY_PATTERN.test(memory)) {
      fail(`${key}.memory must be a size such as 512m or 2g`)
    }
    const networks = strings(`${key}.networks`, config.networks)
    for (const network of networks) {
      if (!NAME_PATTERN.test(network)) fail(`${key}.networks has an invalid name: ${network}`)
      if (network === project()) fail(`${key}.networks must not list the project network`)
    }
    const switching = blueGreen(`${key}.blue_green`, config.blue_green)
    if (switching && config.ports?.length) {
      fail(`${key}.ports cannot be used with blue_green, which publishes its own ports`)
    }
    services[name] = {
      blueGreen: switching,
      init: config.init ?? false,
      healthcheck: healthcheck(`${key}.healthcheck`, config.healthcheck),
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
      memory,
      cpus: cpus(`${key}.cpus`, config.cpus),
      networks: [...new Set(networks)],
      options: engineOptions(`${key}.options`, config.options),
    }
    if (services[name].command?.length === 0) fail(`${key}.command must not be empty`)
  }

  const used = Object.values(services).flatMap((spec) => spec.blueGreen?.ports ?? [])
  if (new Set(used).size !== used.length) {
    fail('container_services: blue_green ports must be unique across services')
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

export function slotName(service: string, slot: Slot): string {
  return `${containerName(service)}-${slot}`
}

function slotPort(spec: ServiceSpec, slot: Slot): number {
  return spec.blueGreen!.ports[SLOTS.indexOf(slot)]
}

function runArgs(stack: Stack, service: string, oneOff?: string[], slot?: Slot): string[] {
  const spec = stack.data.services[service]
  const name = slot ? slotName(service, slot) : containerName(service)
  const args = oneOff
    ? ['--rm', '--network', stack.data.network, '--label', 'com.catapultjs.oneoff=true']
    : ['-d', '--name', name, '--network', stack.data.network]
  if (slot && spec.blueGreen) {
    args.push(
      '--label',
      `${LABEL_SLOT}=${slot}`,
      '-p',
      `127.0.0.1:${slotPort(spec, slot)}:${spec.blueGreen.containerPort}`
    )
  }
  // Extra networks, resources and raw options also apply to the one-off container:
  // a migration may need a database reachable on an external network.
  for (const network of spec.networks ?? []) args.push('--network', network)
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
  if (spec.healthcheck === false) args.push('--no-healthcheck')
  if (typeof spec.healthcheck === 'object' && !oneOff) args.push(...healthArgs(spec.healthcheck))
  if (spec.memory) args.push('--memory', spec.memory)
  if (spec.cpus) args.push('--cpus', spec.cpus)
  if (spec.user) args.push('--user', spec.user)
  if (spec.entrypoint) args.push('--entrypoint', spec.entrypoint)
  for (const file of spec.envFiles) args.push('--env-file', file)
  if (!oneOff) for (const port of spec.ports) args.push('-p', port)
  for (const mount of spec.volumes) args.push('-v', mount)
  args.push(...(spec.options ?? []))
  args.push(releaseRef(stack.release), ...(oneOff ?? spec.command ?? []))
  return args
}

function healthArgs(config: HealthcheckConfig): string[] {
  const args = ['--health-cmd', config.cmd]
  if (config.interval) args.push('--health-interval', config.interval)
  if (config.timeout) args.push('--health-timeout', config.timeout)
  if (config.retries) args.push('--health-retries', String(config.retries))
  if (config.start_period) args.push('--health-start-period', config.start_period)
  return args
}

function engine(stack: Stack, args: string[]): string {
  return `${q(stack.facts.bin)} ${args.map(q).join(' ')}`
}

function ensureNetwork(stack: Stack): string {
  const { network } = stack.data
  return `${engine(stack, ['network', 'inspect', network])} >/dev/null 2>&1 || ${engine(stack, ['network', 'create', '--label', `${LABEL_PROJECT}=${project()}`, network])} >/dev/null`
}

function extraNetworks(data: ContainerData): string[] {
  return [...new Set(Object.values(data.services).flatMap((spec) => spec.networks ?? []))]
}

/** Shell lines failing when an extra network does not exist: Catapult never creates them. */
function networkChecks(bin: string, networks: string[]): string[] {
  return networks.map(
    (network) =>
      `${q(bin)} network inspect ${q(network)} >/dev/null 2>&1 || { echo ${q(`network not found: ${network}`)} >&2; exit 1; }`
  )
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

function blueGreenServices(stack: Stack): string[] {
  return Object.keys(stack.data.services).filter(
    (service) => stack.data.services[service].blueGreen
  )
}

/** Name of every container of the project on the server. */
async function projectContainers(stack: Stack): Promise<string[]> {
  const list = await listContainers(stack.host, stack.facts, [[`${LABEL_PROJECT}=${project()}`]])
  return list.map((container) => container.name)
}

// Caddy settings are shared with recipes/caddy.
function caddySudo(): string {
  return get<boolean>('caddy_use_sudo', true) ? 'sudo ' : ''
}

function caddyConfig(): string {
  return get<string>('caddy_config_path', '/etc/caddy/Caddyfile')
}

/** File imported by the Caddyfile in the reverse_proxy block of a service. */
export function upstreamFile(service: string): string {
  const dir = get<string>('container_caddy_upstreams', '/etc/caddy/catapult')
  return `${dir}/${project()}-${service}.caddy`
}

/** Slot each blue/green service currently receives traffic on, from its upstream file. */
async function liveSlots(stack: Stack): Promise<Record<string, Slot | null>> {
  const services = blueGreenServices(stack)
  const { stdout } = await ssh(
    stack.host,
    services
      .map((service) => `echo ${q(`${service}=`)}"$(cat ${q(upstreamFile(service))} 2>/dev/null)"`)
      .join('\n')
  )
  const live: Record<string, Slot | null> = {}
  for (const service of services) {
    const line = stdout.split('\n').find((item) => item.startsWith(`${service}=`)) ?? ''
    const port = Number(/127\.0\.0\.1:(\d+)/.exec(line)?.[1])
    const index = stack.data.services[service].blueGreen!.ports.indexOf(port)
    live[service] = index === -1 ? null : SLOTS[index]
  }
  return live
}

/**
 * Points Caddy to the given slots: writes the upstream files, validates the whole
 * configuration and reloads Caddy, which lets requests in flight finish. The previous
 * files are restored when the configuration is invalid or the reload fails.
 */
async function switchUpstreams(
  stack: Stack,
  targets: Record<string, Slot>,
  logger: CatapultLogger,
  verbose: number
) {
  const sudo = caddySudo()
  const caddy = `${sudo}${q(stack.host.bin?.caddy ?? 'caddy')}`
  const config = q(caddyConfig())
  const files = Object.entries(targets).map(([service, slot]) => ({
    file: upstreamFile(service),
    port: slotPort(stack.data.services[service], slot),
  }))
  const restore = files
    .map(
      ({ file }) =>
        `if [ -f ${q(`${file}.prev`)} ]; then ${sudo}mv ${q(`${file}.prev`)} ${q(file)}; else ${sudo}rm -f ${q(file)}; fi`
    )
    .join('\n  ')
  const script = [
    'set -e',
    `restore() {\n  ${restore}\n}`,
    ...files.flatMap(({ file, port: slotValue }) => [
      `${sudo}mkdir -p ${q(file.slice(0, file.lastIndexOf('/')))}`,
      `${sudo}cp -p ${q(file)} ${q(`${file}.prev`)} 2>/dev/null || ${sudo}rm -f ${q(`${file}.prev`)}`,
      `printf 'to 127.0.0.1:%s\\n' ${slotValue} | ${sudo}tee ${q(file)} >/dev/null`,
    ]),
    `if ! out=$(${caddy} validate --config ${config} 2>&1); then restore; echo "$out" | tail -n 5 >&2; exit 1; fi`,
    `if ! out=$(${caddy} reload --config ${config} 2>&1); then restore; ${caddy} reload --config ${config} >/dev/null 2>&1 || true; echo "$out" | tail -n 5 >&2; exit 1; fi`,
    ...files.map(({ file }) => `${sudo}rm -f ${q(`${file}.prev`)}`),
  ]
  if (verbose >= Verbose.NORMAL) {
    const summary = files.map(({ file, port: slotValue }) => `${file} -> 127.0.0.1:${slotValue}`)
    logger.step(stack.host.name, `switch Caddy: ${summary.join(', ')}`)
  }
  await ssh(stack.host, script.join('\n')).catch((error: unknown) => {
    throw new Error(
      `[${stack.host.name}] Caddy switch failed, previous upstreams restored: ${failureOutput(error) || (error as Error).message}`,
      { cause: error }
    )
  })
}

/** Requests `health_path` on the new container until it answers or the timeout expires. */
async function checkSlot(
  stack: Stack,
  service: string,
  slot: Slot,
  logger: CatapultLogger,
  verbose: number
) {
  const spec = stack.data.services[service].blueGreen!
  if (!spec.healthPath) return
  const url = `http://127.0.0.1:${slotPort(stack.data.services[service], slot)}${spec.healthPath}`
  const timeout = seconds('container_wait_timeout', 60)
  const deadline = Date.now() + timeout * 1000
  let lastError = ''
  while (true) {
    try {
      await ssh(
        stack.host,
        `set -e\ncurl --fail --silent --show-error --max-time 5 ${q(url)} >/dev/null`
      )
      if (verbose >= Verbose.NORMAL) logger.step(stack.host.name, `${url} OK`)
      return
    } catch (error) {
      lastError = failureOutput(error) || (error as Error).message
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `[${stack.host.name}] ${service} did not answer ${url} within ${timeout}s: ${lastError}`
      )
    }
    await sleep(2_000)
  }
}

/**
 * Replaces the containers with the ones of the release, then waits until they are
 * ready. Blue/green services start in the slot not receiving traffic, are checked,
 * then Caddy switches to them; the previous slot keeps running until `retire`. Other
 * services are replaced in place: expect a short interruption on their ports.
 * `reuse` points blue/green services to running containers of the release instead
 * of starting new ones (a rollback before the previous slot was retired).
 */
async function up(
  stack: Stack,
  logger: CatapultLogger,
  verbose: number,
  reuse: Record<string, Slot> = {}
) {
  const switching = blueGreenServices(stack)
  const live = switching.length ? await liveSlots(stack) : {}
  const next: Record<string, Slot> = {}
  for (const service of switching) {
    next[service] = reuse[service] ?? (live[service] === 'a' ? 'b' : 'a')
  }

  const expected = new Set(
    Object.keys(stack.data.services).flatMap((service) =>
      stack.data.services[service].blueGreen
        ? SLOTS.map((slot) => slotName(service, slot))
        : [containerName(service)]
    )
  )
  const existing = await projectContainers(stack)
  const removed = existing.filter((name) => !expected.has(name))

  // Containers no longer expected go first: a container started before blue/green was
  // enabled may hold one of its ports.
  const script = ['set -e', ensureNetwork(stack)]
  for (const name of removed) script.push(...stopAndRemove(stack, name))
  const started: string[] = []
  for (const service of Object.keys(stack.data.services)) {
    const slot = next[service]
    if (slot && reuse[service]) continue
    const name = slot ? slotName(service, slot) : containerName(service)
    started.push(name)
    script.push(
      ...stopAndRemove(stack, name),
      `${engine(stack, ['run', ...runArgs(stack, service, undefined, slot)])} >/dev/null`
    )
  }

  if (verbose >= Verbose.NORMAL) {
    if (removed.length) logger.step(stack.host.name, `remove ${removed.join(', ')}`)
    if (started.length) logger.step(stack.host.name, `start ${started.join(', ')}`)
  }
  await ssh(stack.host, script.join('\n'))
  await wait(stack, logger, verbose, true)

  if (!switching.length) return
  for (const service of switching) await checkSlot(stack, service, next[service], logger, verbose)
  await switchUpstreams(stack, next, logger, verbose)
}

/**
 * Stops the blue/green containers that no longer receive traffic, after leaving them
 * `drain` seconds to finish their requests.
 */
async function retire(stack: Stack, logger: CatapultLogger, verbose: number) {
  const switching = blueGreenServices(stack)
  if (!switching.length) return
  const live = await liveSlots(stack)
  const existing = new Set(await projectContainers(stack))
  const idle = switching.flatMap((service) =>
    live[service]
      ? SLOTS.filter((slot) => slot !== live[service])
          .map((slot) => slotName(service, slot))
          .filter((name) => existing.has(name))
      : []
  )
  if (!idle.length) return
  const drain = Math.max(
    ...switching.map((service) => stack.data.services[service].blueGreen!.drain)
  )
  if (verbose >= Verbose.NORMAL)
    logger.step(stack.host.name, `drain ${drain}s, then stop ${idle.join(', ')}`)
  if (drain) await sleep(drain * 1000)
  await ssh(
    stack.host,
    ['set -e', ...idle.flatMap((name) => stopAndRemove(stack, name))].join('\n')
  )
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
  if (files.length) {
    try {
      await ssh(host, `set -e\n${files.map((file) => `[ -f ${q(file)} ]`).join('\n')}`)
    } catch {
      throw new Error(`[${host.name}] release ${ctx.release} is missing env files`)
    }
  }
  const networks = extraNetworks(target.data)
  if (networks.length) {
    await ssh(host, ['set -e', ...networkChecks(target.facts.bin, networks)].join('\n')).catch(
      (error: unknown) => {
        throw new Error(
          `[${host.name}] release ${ctx.release} cannot be restored: ${failureOutput(error)}`,
          { cause: error }
        )
      }
    )
  }
})

onRollback(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  const target = await loadStack(host, logger, ctx.release, paths.release)
  const verbose = ctx.config.verbose ?? Verbose.SILENT
  // Blue/green services still running the target release (the deployment failed
  // before `retire`) switch back to it without restarting anything.
  const reuse: Record<string, Slot> = {}
  const switching = blueGreenServices(target)
  if (switching.length) {
    const running = await listContainers(
      host,
      target.facts,
      switching.map((service) => [
        `${LABEL_PROJECT}=${project()}`,
        `${LABEL_SERVICE}=${service}`,
        `${LABEL_RELEASE}=${target.release}`,
      ])
    )
    for (const service of switching) {
      const slot = SLOTS.find((item) =>
        running.some((c) => c.name === slotName(service, item) && c.state === 'running')
      )
      if (slot) reuse[service] = slot
    }
  }
  await up(target, logger, verbose, reuse)
  await retire(target, logger, verbose)
})

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

desc('Checks the container configuration and the restart service')
task('container:check', async ({ host, logger }: TaskContext) => {
  const configs = serviceConfigs()
  migration()
  const facts = await hostFacts(host, logger)
  // `docker run` accepts several --network flags since Docker 25.
  const major = Number(/Docker version (\d+)\./.exec(facts.version)?.[1] ?? 0)
  if (facts.engine === 'docker' && major && major < 25) {
    const withNetworks = Object.entries(configs)
      .filter(([, config]) => Array.isArray(config?.networks) && config.networks.length)
      .map(([name]) => name)
    if (withNetworks.length) {
      fail(
        `[${host.name}] extra networks require Docker 25 or later (found ${facts.version}): ${withNetworks.join(', ')}`
      )
    }
  }
  await checkPodmanRestart(host, facts, logger)
})

desc('Writes the env files of the release and records how its containers start')
task('container:prepare', async ({ host, logger, release, paths }: TaskContext) => {
  const { data, envFiles } = specs(paths.release)
  const facts = await hostFacts(host, logger)
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
  script.push(...networkChecks(facts.bin, extraNetworks(data)))
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
  ).catch((error: unknown) => {
    const code = exitCodeOf(error)
    throw new Error(
      `[${host.name}] migration failed${code === undefined ? '' : ` (exit code ${code})`}: ${failureOutput(error) || (error as Error).message}`,
      { cause: error }
    )
  })
  if (verbosity(ctx) >= Verbose.NORMAL && stdout.trim()) logger.log(stdout.trim())
})

desc('Replaces the containers with the ones of the release and waits until they are ready')
task('container:up', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  await up(target, ctx.logger, verbosity(ctx))
})

desc('Stops the blue/green containers that no longer receive traffic, after draining them')
task('container:retire', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  await retire(target, ctx.logger, verbosity(ctx))
})

desc('Starts the existing containers')
task('container:start', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  const names = await projectContainers(target)
  await ssh(ctx.host, `set -e\n${engine(target, ['start', ...names])} >/dev/null`)
  await wait(target, ctx.logger, verbosity(ctx))
})

desc('Stops the containers')
task('container:stop', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await loadStack(host, logger, release, paths.release)
  const timeout = String(seconds('container_stop_timeout', 10))
  const names = await projectContainers(target)
  await ssh(host, `set -e\n${engine(target, ['stop', '-t', timeout, ...names])} >/dev/null`)
})

desc('Restarts the containers and waits until they are ready')
task('container:restart', async (ctx: TaskContext) => {
  const target = await loadStack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  const timeout = String(seconds('container_stop_timeout', 10))
  const names = await projectContainers(target)
  await ssh(ctx.host, `set -e\n${engine(target, ['restart', '-t', timeout, ...names])} >/dev/null`)
  await wait(target, ctx.logger, verbosity(ctx))
})

desc('Stops and removes the containers (volumes and network are kept)')
task('container:remove', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await loadStack(host, logger, release, paths.release)
  const names = await projectContainers(target)
  await ssh(host, ['set -e', ...names.flatMap((name) => stopAndRemove(target, name))].join('\n'))
})

desc('Displays the logs of the containers')
task('container:logs', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await loadStack(host, logger, release, paths.release)
  const containers = await projectContainers(target)
  const script = containers.map(
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
  'container:retire',
  'deploy:cleanup',
  'oci:cleanup',
  'deploy:unlock',
])
