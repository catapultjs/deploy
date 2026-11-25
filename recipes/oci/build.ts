/**
 * Local image build, run once per release and platform. Internal to the container recipes.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import { type CatapultLogger } from '../../src/logger.ts'
import { Verbose } from '../../src/enums.ts'
import {
  type Engine,
  buildOptions,
  configuredBuildEngine,
  platformFromArch,
  project,
  releaseRef,
} from './config.ts'
import { localEngine } from './engine.ts'

export interface BuildResult {
  ref: string
  engine: Engine
  localId: string
  /** Hash of the layers and runtime config: stable across identical builds. */
  contentKey: string
  /** Whether the image declares a HEALTHCHECK. */
  healthcheck: boolean
  platform: string
  revision: string | null
  dirty: boolean
}

/** `{{json .RootFS.Layers}}` and `{{json .Config}}` of an image, on one line each. */
export const CONTENT_FORMAT = '{{json .RootFS.Layers}}\n{{json .Config}}'

/**
 * Content identity of a local image. Image IDs are not enough: Docker with the
 * containerd store identifies an image by its index, which embeds a provenance
 * attestation that changes on every build even when the image is identical.
 */
export function contentKey(inspectOutput: string): string {
  return `sha256:${createHash('sha256').update(inspectOutput.trim()).digest('hex')}`
}

export function declaresHealthcheck(inspectOutput: string): boolean {
  try {
    const config = JSON.parse(inspectOutput.trim().split('\n').at(-1) ?? 'null')
    const test = config?.Healthcheck?.Test
    return Array.isArray(test) && test.length > 0 && test[0] !== 'NONE'
  } catch {
    return false
  }
}

interface BuildRequest {
  release: string
  platform: string
  serverEngine: Engine
  logger: CatapultLogger
  verbose: number
  host: Host
}

const builds = new Map<string, { platform: string; result: Promise<BuildResult> }>()

async function git(args: string[]): Promise<string | null> {
  const result = await execa('git', args, { reject: false })
  return result.exitCode === 0 ? result.stdout.trim() : null
}

/** Local commit and whether the working tree has uncommitted changes. */
export async function revisionInfo(): Promise<{ revision: string | null; dirty: boolean }> {
  const revision = await git(['rev-parse', 'HEAD'])
  const status = await git(['status', '--porcelain'])
  return { revision, dirty: Boolean(status) }
}

function ignoresEnv(context: string): boolean {
  for (const name of ['.containerignore', '.dockerignore']) {
    const file = join(context, name)
    if (!existsSync(file)) continue
    const patterns = readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
    return patterns.some((pattern) =>
      ['.env', '.env*', '*.env', '**/.env', '**/.env*', '*', '**'].includes(pattern)
    )
  }
  return false
}

export function containerfile(context: string, file?: string): string {
  if (file) return file
  for (const name of ['Containerfile', 'Dockerfile']) {
    if (existsSync(join(context, name))) return join(context, name)
  }
  throw new Error(`no Containerfile or Dockerfile found in ${context}. Set container_build.file`)
}

/**
 * Build arguments used by instructions that Podman (Buildah) caches without their
 * value: only RUN instructions account for build arguments in its layer cache. An
 * ENV or LABEL using an argument before any RUN keeps the previous value when only
 * the argument changes. Docker invalidates the cache as expected.
 */
export function cachedArgUses(containerfileContent: string, argNames: string[]): string[] {
  const instructions: string[] = []
  let current = ''
  for (const raw of containerfileContent.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    current = current ? `${current} ${line}` : line
    if (current.endsWith('\\')) {
      current = current.slice(0, -1)
      continue
    }
    instructions.push(current)
    current = ''
  }
  if (current) instructions.push(current)

  const stale = new Set<string>()
  const declared = new Set<string>()
  for (const instruction of instructions) {
    const keyword = instruction.split(/\s+/)[0].toUpperCase()
    if (keyword === 'FROM' || keyword === 'RUN') {
      declared.clear()
    } else if (keyword === 'ARG') {
      for (const token of instruction.slice(3).trim().split(/\s+/)) {
        const name = token.split('=')[0]
        if (argNames.includes(name)) declared.add(name)
      }
    } else {
      for (const name of declared) {
        if (new RegExp(`\\$\\{?${name}\\b`).test(instruction)) stale.add(name)
      }
    }
  }
  return [...stale]
}

/** Warns when Podman would keep stale build argument values from its layer cache. */
export function warnCachedArgUses(file: string, logger: CatapultLogger, host: Host): void {
  const names = Object.keys(buildOptions().args ?? {})
  if (!names.length) return
  const stale = cachedArgUses(readFileSync(file, 'utf8'), names)
  if (stale.length) {
    logger.warning(
      `Podman caches instructions using ${stale.join(', ')} without the argument value: the image keeps the previous value when only the argument changes. Add a RUN instruction between the ARG and the instructions using it`,
      { prefix: host.name }
    )
  }
}

/** Warns about what the build context would include unintentionally. */
export function contextWarnings(
  context: string,
  dirty: boolean,
  logger: CatapultLogger,
  host: Host
): void {
  if (dirty) {
    logger.warning('uncommitted changes are included in the image build context', {
      prefix: host.name,
    })
  }
  if (existsSync(join(context, '.env')) && !ignoresEnv(context)) {
    logger.warning(
      '.env is not excluded by .containerignore or .dockerignore: it would be copied into the build context',
      { prefix: host.name }
    )
  }
}

async function run(engine: Engine, args: string[], request: BuildRequest) {
  if (request.verbose >= Verbose.TRACE) request.logger.cmd(`${engine} ${args.join(' ')}`)
  const subprocess = execa(engine, args)
  if (request.verbose >= Verbose.DEBUG) {
    subprocess.stdout?.pipe(process.stdout)
    subprocess.stderr?.pipe(process.stderr)
  }
  return subprocess
}

async function build(request: BuildRequest): Promise<BuildResult> {
  const options = buildOptions()
  const context = resolve(options.context ?? '.')
  const file = containerfile(context, options.file)
  const engine = await localEngine(request.serverEngine, configuredBuildEngine())
  const ref = releaseRef(request.release)

  const { revision, dirty } = await revisionInfo()
  contextWarnings(context, dirty, request.logger, request.host)
  const localPlatform = platformFromArch(process.arch)
  if (localPlatform !== request.platform) {
    request.logger.warning(
      `building ${request.platform} on ${localPlatform}: emulation can be slow`,
      { prefix: request.host.name }
    )
  }

  const args = ['build', '-f', file, '-t', ref, '--platform', request.platform]
  // Podman builds OCI images by default, which drop HEALTHCHECK.
  if (engine === 'podman') {
    args.push('--format', 'docker')
    warnCachedArgUses(file, request.logger, request.host)
  }
  if (options.target) args.push('--target', options.target)
  for (const [name, value] of Object.entries(options.args ?? {})) {
    args.push('--build-arg', `${name}=${value}`)
  }
  args.push('--label', `com.catapultjs.project=${project()}`, context)

  if (request.verbose >= Verbose.NORMAL) {
    request.logger.step(request.host.name, `build ${ref} (${request.platform}) with ${engine}`)
  }
  await run(engine, args, request)

  const inspect = await execa(engine, ['image', 'inspect', '--format', '{{.Id}}', ref])
  const content = await execa(engine, ['image', 'inspect', '--format', CONTENT_FORMAT, ref])
  return {
    ref,
    engine,
    localId: inspect.stdout.trim(),
    contentKey: contentKey(content.stdout),
    healthcheck: declaresHealthcheck(content.stdout),
    platform: request.platform,
    revision,
    dirty,
  }
}

/**
 * Builds the release image once per deployment. Hosts deployed afterwards reuse
 * it; a host with another architecture is rejected (multi-arch is not supported yet).
 */
export function buildOnce(request: BuildRequest): Promise<BuildResult> {
  const existing = builds.get(request.release)
  if (existing) {
    if (existing.platform !== request.platform) {
      return Promise.reject(
        new Error(
          `[${request.host.name}] requires ${request.platform} but the release image was built for ${existing.platform}. Deploying to several architectures is not supported yet`
        )
      )
    }
    return existing.result
  }
  const result = build(request)
  builds.set(request.release, { platform: request.platform, result })
  return result
}

/** Build result for the release, if this process built it. */
export function builtImage(release: string): Promise<BuildResult> | undefined {
  return builds.get(release)?.result
}
