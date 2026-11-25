/**
 * TYPE: container
 * DESCRIPTION:
 * Deploys a Compose stack with Docker or Podman. The release image is built locally,
 * streamed over SSH (no registry), then pinned for each release through a generated
 * Compose override, so a rollback restarts the exact images of the restored release.
 */
import type {} from '../src/types.ts'
import { existsSync } from 'node:fs'
import { posix } from 'node:path'
import {
  type TaskContext,
  task,
  desc,
  get,
  set,
  upload,
  initPipeline,
  onSetup,
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
import { imageName, project, releaseRef, sourceImage } from './oci/config.ts'
import { type RemoteFacts, checkPodmanRestart, hostFacts } from './oci/engine.ts'
import { listContainers, waitReady } from './oci/readiness.ts'
import { readManifest, setManifestExtra } from './oci/manifest.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'compose:check': true
    'compose:upload': true
    'compose:override': true
    'compose:validate': true
    'compose:pull': true
    'compose:migrate': true
    'compose:up': true
    'compose:stop': true
    'compose:restart': true
    'compose:down': true
    'compose:logs': true
    'compose:status': true
  }
}

set('oci_recipe', 'compose')

export const OVERRIDE_FILE = 'compose.catapult.yml'
const DEFAULT_FILES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml']
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/
const PROJECT_LABEL = 'com.docker.compose.project'
const SERVICE_LABEL = 'com.docker.compose.service'

interface Migration {
  service: string
  command: string[]
}

interface ComposeData {
  files: string[]
  profiles: string[]
  imageServices: string[]
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function relativePath(key: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must contain paths`)
  const normalized = posix.normalize(value.replaceAll('\\', '/')).replace(/\/+$/, '')
  if (
    posix.isAbsolute(normalized) ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('-')
  ) {
    throw new Error(`${key} must contain paths relative to the project, inside it: ${value}`)
  }
  return normalized
}

function pathList(key: string, value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error(`${key} must be an array of paths`)
  const paths = value.map((item) => relativePath(key, item))
  if (new Set(paths).size !== paths.length) throw new Error(`${key} contains duplicates`)
  return paths
}

function nameList(key: string, fallback: string[] = []): string[] {
  const value = get<unknown>(key, fallback)
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || !NAME_PATTERN.test(item))
  ) {
    throw new Error(`${key} must be an array of names (letters, digits, ".", "_" or "-")`)
  }
  return [...new Set(value as string[])]
}

export function composeFiles(): string[] {
  const value = get<unknown>('compose_files')
  if (value === undefined) {
    const found = DEFAULT_FILES.find((file) => existsSync(file))
    if (!found) {
      throw new Error(`no Compose file found (${DEFAULT_FILES.join(', ')}). Set compose_files`)
    }
    return [found]
  }
  const files = pathList('compose_files', value)
  if (!files.length) throw new Error('compose_files must not be empty')
  if (files.includes(OVERRIDE_FILE)) throw new Error(`${OVERRIDE_FILE} is reserved by Catapult`)
  return files
}

function uploads(): string[] {
  return pathList('compose_upload', get<unknown>('compose_upload', []))
}

function profiles(): string[] {
  return nameList('compose_profiles')
}

function targetServices(): string[] {
  return nameList('compose_services')
}

function configuredImageServices(): string[] | undefined {
  return get<unknown>('compose_image_services') === undefined
    ? undefined
    : nameList('compose_image_services')
}

function removeOrphans(): boolean {
  const value = get<unknown>('compose_remove_orphans', false)
  if (typeof value !== 'boolean') throw new Error('compose_remove_orphans must be a boolean')
  return value
}

function migration(): Migration | undefined {
  const value = get<Migration | undefined>('compose_migrate')
  if (value === undefined) return undefined
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.service !== 'string' ||
    !NAME_PATTERN.test(value.service) ||
    !Array.isArray(value.command) ||
    !value.command.length ||
    value.command.some((arg) => typeof arg !== 'string')
  ) {
    throw new Error('compose_migrate must be { service: string, command: string[] }')
  }
  return value
}

function waitTimeout(): number {
  const value = Number(get<number>('compose_wait_timeout', 60))
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('compose_wait_timeout must be a positive number of seconds')
  }
  return value
}

function logLines(): number {
  const value = Number(get<number>('compose_logs_lines', 100))
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 100
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** A release of the stack on a host, with the Compose files and profiles it was deployed with. */
interface Stack {
  host: Host
  facts: RemoteFacts
  path: string
  data: ComposeData
}

const stacks = new Map<string, ComposeData>()

/**
 * Compose files and profiles of a release: from this deployment, else from its
 * manifest (a rollback or a manual task replays them exactly), else the current config.
 */
async function stack(
  host: Host,
  logger: CatapultLogger,
  release: string,
  path: string
): Promise<Stack> {
  const facts = await hostFacts(host, logger)
  let data = stacks.get(`${host.name}|${release}`)
  if (!data) {
    const manifest = await readManifest(host, path)
    const recorded = manifest?.compose as ComposeData | undefined
    data = recorded?.files?.length
      ? recorded
      : { files: composeFiles(), profiles: profiles(), imageServices: [] }
  }
  return { host, facts, path, data }
}

/** `cd <release> && <engine> compose -p … -f … --profile …`, ready for a subcommand. */
function compose(target: Stack, withOverride = true): string {
  const files = [...target.data.files, ...(withOverride ? [OVERRIDE_FILE] : [])]
  const args = [
    '-p',
    project(),
    ...files.flatMap((file) => ['-f', file]),
    ...target.data.profiles.flatMap((profile) => ['--profile', profile]),
  ]
  return `cd ${q(target.path)}\n${q(target.facts.bin)} compose ${args.map(q).join(' ')}`
}

function verbosity(ctx: { config: TaskContext['config'] }): number {
  return ctx.config.verbose ?? Verbose.SILENT
}

const ANSI_CODES = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

/** Removes ANSI codes and the banner `podman compose` prints before running a provider. */
export function cleanOutput(output: string): string {
  return output
    .replaceAll(ANSI_CODES, '')
    .split('\n')
    .filter((line) => !line.includes('>>>>'))
    .join('\n')
    .trim()
}

async function composeOutput(target: Stack, subcommand: string, withOverride = true) {
  try {
    const { stdout } = await ssh(
      target.host,
      `set -e\n${compose(target, withOverride)} ${subcommand}`
    )
    return stdout
  } catch (error) {
    const stderr = cleanOutput(String((error as { stderr?: unknown }).stderr ?? ''))
    const name = subcommand.split(' ')[0]
    throw new Error(
      `[${target.host.name}] compose ${name} failed: ${stderr || (error as Error).message}`,
      { cause: error }
    )
  }
}

function lines(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function serviceArgs(services: string[]): string {
  return services.map(q).join(' ')
}

// ---------------------------------------------------------------------------
// Provider checks
// ---------------------------------------------------------------------------

async function checkCompose(host: Host, logger: CatapultLogger): Promise<string> {
  const facts = await hostFacts(host, logger)
  const systemctl = facts.rootless ? 'systemctl --user' : 'systemctl'
  const { stdout } = await ssh(
    host,
    `set +e
out=$(${q(facts.bin)} compose version 2>&1)
echo "status=$?"
printf '%s\n' "$out" | sed 's/^/line=/'
if [ ${q(facts.engine)} = podman ] && command -v systemctl >/dev/null 2>&1; then
  echo "socket=$(${systemctl} is-active podman.socket 2>/dev/null)"
fi`
  )
  const outputLines = stdout.split('\n')
  const values = Object.fromEntries(
    outputLines
      .filter((line) => line.includes('=') && !line.startsWith('line='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()])
  )
  // The Podman banner mentions podman-compose(1) whatever the provider: read the
  // provider from its own version line instead.
  const output = cleanOutput(
    outputLines
      .filter((line) => line.startsWith('line='))
      .map((line) => line.slice(5))
      .join('\n')
  )
  const version = output
    .split('\n')
    .find((line) => /compose/i.test(line))
    ?.trim()
  const provider = /podman-compose/i.test(version ?? '') ? 'podman-compose' : 'docker-compose'

  if (values.status !== '0') {
    throw new Error(
      facts.engine === 'docker'
        ? `[${host.name}] docker compose is not available: install the Docker Compose plugin`
        : `[${host.name}] podman compose found no provider: install docker-compose or podman-compose`
    )
  }

  if (facts.engine === 'podman') {
    const user = facts.rootless ? ' --user' : ''
    if (provider === 'docker-compose' && values.socket && values.socket !== 'active') {
      throw new Error(
        `[${host.name}] the docker-compose provider needs the Podman API but podman.socket is not active. Run \`systemctl${user} enable --now podman.socket\` on the server`
      )
    }
  }

  await checkPodmanRestart(host, facts, logger)
  return version || 'compose'
}

// ---------------------------------------------------------------------------
// Service images
// ---------------------------------------------------------------------------

function repository(image: string): string {
  const withoutDigest = image.split('@')[0]
  const slash = withoutDigest.lastIndexOf('/')
  const colon = withoutDigest.lastIndexOf(':')
  return colon > slash ? withoutDigest.slice(0, colon) : withoutDigest
}

/** Services running the release image: built by Compose or referencing the project image. */
export function detectImageServices(services: Record<string, { image?: string; build?: unknown }>) {
  const name = imageName()
  const source = sourceImage()
  return Object.entries(services)
    .filter(([, service]) => {
      if (service.build) return true
      if (!service.image) return false
      const repo = repository(service.image)
      return repo === name || repo === `localhost/${name}` || service.image === source
    })
    .map(([service]) => service)
}

/**
 * Extracts `image` and `build` of each service from the YAML printed by
 * `compose config`. Minimal on purpose: only needed for providers without JSON
 * output (podman-compose), whose output is a plain resolved mapping.
 */
export function yamlServices(yaml: string): Record<string, { image?: string; build?: boolean }> {
  const result: Record<string, { image?: string; build?: boolean }> = {}
  let inServices = false
  let serviceIndent = -1
  let keyIndent = -1
  let current: string | null = null

  for (const raw of yaml.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length
    if (indent === 0) {
      inServices = line === 'services:'
      serviceIndent = -1
      current = null
      continue
    }
    if (!inServices) continue
    if (serviceIndent === -1) serviceIndent = indent
    if (indent === serviceIndent) {
      const match = line.match(/^['"]?([^'":]+)['"]?:\s*$/)
      current = match ? match[1] : null
      if (current) result[current] = {}
      keyIndent = -1
      continue
    }
    if (!current || indent < serviceIndent) continue
    if (keyIndent === -1) keyIndent = indent
    if (indent !== keyIndent) continue
    const match = line.match(/^(image|build):\s*(.*)$/)
    if (match?.[1] === 'build') result[current].build = true
    if (match?.[1] === 'image') result[current].image = match[2].replace(/^['"]|['"]$/g, '')
  }
  return result
}

/** Resolved services, from JSON when the provider supports it, else from YAML. */
async function resolvedServices(target: Stack) {
  try {
    const config = JSON.parse(await composeOutput(target, 'config --format json', false))
    return (config.services ?? {}) as Record<string, { image?: string; build?: unknown }>
  } catch {
    return yamlServices(await composeOutput(target, 'config', false))
  }
}

function overrideYaml(services: string[], ref: string): string {
  const yaml = ['# Generated by Catapult: pins the release image. Do not edit.', 'services:']
  for (const service of services) {
    yaml.push(
      `  ${JSON.stringify(service)}:`,
      `    image: ${JSON.stringify(ref)}`,
      '    pull_policy: never'
    )
  }
  if (!services.length) yaml[1] = 'services: {}'
  return `${yaml.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/** Services to start and check: compose_services, else every service of the release. */
async function checkedServices(target: Stack): Promise<string[]> {
  const targets = targetServices()
  return targets.length ? targets : lines(await composeOutput(target, 'config --services'))
}

function serviceFilters(services: string[]): string[][] {
  return services.map((service) => [`${PROJECT_LABEL}=${project()}`, `${SERVICE_LABEL}=${service}`])
}

async function waitStack(target: Stack, logger: CatapultLogger, verbose: number) {
  await waitReady({
    host: target.host,
    facts: target.facts,
    filterSets: serviceFilters(await checkedServices(target)),
    timeoutSeconds: waitTimeout(),
    logger,
    verbose,
    logsTask: 'compose:logs',
  })
}

async function up(target: Stack, logger: CatapultLogger, verbose: number) {
  const flags = ['-d', '--no-build', ...(removeOrphans() ? ['--remove-orphans'] : [])]
  const output = await composeOutput(
    target,
    `up ${flags.join(' ')} ${serviceArgs(targetServices())}`
  )
  if (verbose >= Verbose.DEBUG && output.trim()) logger.log(output.trim())
  await waitStack(target, logger, verbose)
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

onSetup(async (_ctx, host, logger) => {
  logger.step(host.name, await checkCompose(host, logger))
})

onStatus(async (_ctx, host, logger) => {
  try {
    const facts = await hostFacts(host, logger)
    const data: Record<string, string> = {}
    const list = await listContainers(host, facts, [[`${PROJECT_LABEL}=${project()}`]])
    for (const container of list) {
      data[`compose:${container.name}`] = container.status || container.state
    }
    return data
  } catch {
    return { compose: 'unavailable' }
  }
})

onBeforeRollback(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  const target = await stack(host, logger, ctx.release, paths.release)
  const files = [...target.data.files, OVERRIDE_FILE].map((file) => `${paths.release}/${file}`)
  try {
    await ssh(host, `set -e\n${files.map((file) => `[ -f ${q(file)} ]`).join('\n')}`)
  } catch {
    throw new Error(
      `[${host.name}] release ${ctx.release} is missing its Compose files or ${OVERRIDE_FILE}`
    )
  }
})

onRollback(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  const target = await stack(host, logger, ctx.release, paths.release)
  await up(target, logger, ctx.config.verbose ?? Verbose.SILENT)
})

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

desc('Checks the Compose provider on the server')
task('compose:check', async ({ host, logger, config }: TaskContext) => {
  const version = await checkCompose(host, logger)
  if ((config.verbose ?? 0) >= Verbose.NORMAL) logger.step(host.name, version)
})

desc('Uploads the Compose files and compose_upload paths to the release')
task('compose:upload', async ({ host, paths }: TaskContext) => {
  const files = [...composeFiles(), ...uploads()]
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`${file} does not exist locally`)
  }
  const parents = [
    ...new Set(files.map((file) => posix.dirname(file)).filter((dir) => dir !== '.')),
  ]
  if (parents.length) {
    await ssh(
      host,
      `set -e\n${parents.map((dir) => `mkdir -p ${q(`${paths.release}/${dir}`)}`).join('\n')}`
    )
  }
  for (const file of files) await upload(file, `${paths.release}/${file}`)
})

desc('Generates the Compose override that pins the release image')
task('compose:override', async ({ host, logger, release, paths }: TaskContext) => {
  const data: ComposeData = { files: composeFiles(), profiles: profiles(), imageServices: [] }
  const target: Stack = { host, facts: await hostFacts(host, logger), path: paths.release, data }
  const known = lines(await composeOutput(target, 'config --services', false))

  let services = configuredImageServices()
  if (services) {
    const unknown = services.filter((service) => !known.includes(service))
    if (unknown.length) {
      throw new Error(`compose_image_services lists unknown services: ${unknown.join(', ')}`)
    }
  } else {
    services = detectImageServices(await resolvedServices(target))
  }

  if (!services.length) {
    logger.warning(
      `no service uses the release image (image "${imageName()}" or a build section). Set compose_image_services`,
      { prefix: host.name }
    )
  }

  await ssh(
    host,
    `set -e\nprintf '%s' ${q(overrideYaml(services, releaseRef(release)))} > ${q(`${paths.release}/${OVERRIDE_FILE}`)}`
  )
  data.imageServices = services
  stacks.set(`${host.name}|${release}`, data)
  setManifestExtra(host.name, release, 'compose', data)
})

desc('Validates the Compose configuration of the release')
task('compose:validate', async ({ host, logger, release, paths }: TaskContext) => {
  await composeOutput(await stack(host, logger, release, paths.release), 'config >/dev/null')
})

desc('Pulls the external images of the stack (not the release image)')
task('compose:pull', async (ctx: TaskContext) => {
  const { host, logger, release, paths } = ctx
  const target = await stack(host, logger, release, paths.release)
  const all = lines(await composeOutput(target, 'config --services'))
  const targets = targetServices()
  const external = all.filter(
    (service) =>
      !target.data.imageServices.includes(service) && (!targets.length || targets.includes(service))
  )
  if (!external.length) return
  if (verbosity(ctx) >= Verbose.NORMAL) logger.step(host.name, `pull ${external.join(', ')}`)
  await composeOutput(target, `pull ${serviceArgs(external)}`)
})

desc('Runs compose_migrate in a one-off container of the new release, before publication')
task('compose:migrate', async (ctx: TaskContext) => {
  const job = migration()
  if (!job) return
  const { host, logger, release, paths } = ctx
  const target = await stack(host, logger, release, paths.release)
  if (verbosity(ctx) >= Verbose.NORMAL) {
    logger.step(host.name, `migrate: ${job.service} ${job.command.join(' ')}`)
  }
  const output = await composeOutput(
    target,
    `run --rm -T ${q(job.service)} ${job.command.map(q).join(' ')}`
  )
  if (verbosity(ctx) >= Verbose.NORMAL && output.trim()) logger.log(output.trim())
})

desc('Starts the stack of the release and waits until its containers are ready')
task('compose:up', async (ctx: TaskContext) => {
  const target = await stack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  await up(target, ctx.logger, verbosity(ctx))
})

desc('Stops the stack (containers, networks and volumes are kept)')
task('compose:stop', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await stack(host, logger, release, paths.release)
  await composeOutput(target, `stop ${serviceArgs(targetServices())}`)
})

desc('Restarts the stack and waits until its containers are ready')
task('compose:restart', async (ctx: TaskContext) => {
  const target = await stack(ctx.host, ctx.logger, ctx.release, ctx.paths.release)
  await composeOutput(target, `restart ${serviceArgs(targetServices())}`)
  await waitStack(target, ctx.logger, verbosity(ctx))
})

desc('Removes the containers and networks of the stack (volumes are kept)')
task('compose:down', async ({ host, logger, release, paths }: TaskContext) => {
  await composeOutput(await stack(host, logger, release, paths.release), 'down')
})

desc('Displays the logs of the stack')
task('compose:logs', async ({ host, logger, release, paths }: TaskContext) => {
  const target = await stack(host, logger, release, paths.release)
  const output = await composeOutput(
    target,
    `logs --no-color --tail ${logLines()} ${serviceArgs(targetServices())} 2>&1`
  )
  logger.log(cleanOutput(output))
})

desc('Displays the containers of the stack')
task('compose:status', async ({ host, logger, release, paths }: TaskContext) => {
  const output = await composeOutput(await stack(host, logger, release, paths.release), 'ps -a')
  logger.log(output.trim())
})

initPipeline([
  'deploy:lock',
  'oci:check',
  'compose:check',
  'deploy:release',
  'compose:upload',
  'deploy:shared',
  'compose:override',
  'compose:validate',
  'oci:build',
  'oci:transfer',
  'compose:pull',
  'compose:migrate',
  'deploy:publish',
  'compose:up',
  'deploy:log_revision',
  'deploy:healthcheck',
  'deploy:cleanup',
  'oci:cleanup',
  'deploy:unlock',
])
