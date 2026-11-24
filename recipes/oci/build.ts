/**
 * Local image build, run once per release and platform. Internal to the container recipes.
 */
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
  platform: string
  revision: string | null
  dirty: boolean
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

function containerfile(context: string, file?: string): string {
  if (file) return file
  for (const name of ['Containerfile', 'Dockerfile']) {
    if (existsSync(join(context, name))) return join(context, name)
  }
  throw new Error(`no Containerfile or Dockerfile found in ${context}. Set container_build.file`)
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
  if (dirty) {
    request.logger.warning('uncommitted changes are included in the image build context', {
      prefix: request.host.name,
    })
  }
  if (existsSync(join(context, '.env')) && !ignoresEnv(context)) {
    request.logger.warning(
      '.env is not excluded by .containerignore or .dockerignore: it would be copied into the build context',
      { prefix: request.host.name }
    )
  }
  const localPlatform = platformFromArch(process.arch)
  if (localPlatform !== request.platform) {
    request.logger.warning(
      `building ${request.platform} on ${localPlatform}: emulation can be slow`,
      { prefix: request.host.name }
    )
  }

  const args = ['build', '-f', file, '-t', ref, '--platform', request.platform]
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
  return {
    ref,
    engine,
    localId: inspect.stdout.trim(),
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
