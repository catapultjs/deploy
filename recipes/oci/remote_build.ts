/**
 * Image build on the servers: the build context is synchronized with rsync, then each
 * server builds the release image natively. Internal to the container recipes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { Verbose } from '../../src/enums.ts'
import { q, resolveSshArgs, rsyncSshFlag, ssh } from '../../src/utils.ts'
import { buildOptions, project, releaseRef } from './config.ts'
import type { RemoteFacts } from './engine.ts'
import {
  CONTENT_FORMAT,
  containerfile,
  contentKey,
  contextWarnings,
  revisionInfo,
  warnCachedArgUses,
} from './build.ts'
import { failureOutput } from './output.ts'

export interface RemoteBuildResult {
  ref: string
  remoteId: string
  contentKey: string
  platform: string
  revision: string | null
  dirty: boolean
}

interface RemoteBuildRequest {
  host: Host
  facts: RemoteFacts
  release: string
  /** `.catapult` directory of the host: the context is kept in `build/` between deployments. */
  cataConfig: string
  logger: CatapultLogger
  verbose: number
}

const builds = new Map<string, Promise<RemoteBuildResult>>()

/** Ignore file the server engine applies: Docker reads .dockerignore only. */
function ignoreFile(context: string, engine: RemoteFacts['engine']): string | null {
  const names = engine === 'docker' ? ['.dockerignore'] : ['.containerignore', '.dockerignore']
  const found = names.map((name) => join(context, name)).find((file) => existsSync(file))
  return found ?? null
}

/**
 * rsync options skipping what the engine would ignore anyway, so the context does not
 * carry node_modules or .env to the server. Patterns are anchored at the context root,
 * as the engines read them. A negation (`!pattern`) cannot be translated safely: the
 * whole context is then sent and the engine applies the ignore file alone.
 */
export function rsyncExcludes(
  ignoreContent: string | null,
  keep: string[]
): { args: string[]; translated: boolean } {
  const args = ['--exclude=/.git']
  if (ignoreContent === null) return { args, translated: true }
  const patterns = ignoreContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
  if (patterns.some((pattern) => pattern.startsWith('!'))) return { args, translated: false }
  // The engines always read the Containerfile and the ignore file, even when ignored.
  for (const path of keep) args.push(`--include=/${path}`)
  for (const pattern of patterns) {
    args.push(`--exclude=/${pattern.replace(/^(\.\/|\/)+/, '')}`)
  }
  return { args, translated: true }
}

async function build(request: RemoteBuildRequest): Promise<RemoteBuildResult> {
  const { host, facts, logger, verbose } = request
  const options = buildOptions()
  const context = resolve(options.context ?? '.')
  const file = relative(context, resolve(containerfile(context, options.file)))
  if (file.startsWith('..') || isAbsolute(file)) {
    throw new Error(
      'container_build.file must be inside the build context with container_build.location "remote"'
    )
  }
  const { revision, dirty } = await revisionInfo()
  contextWarnings(context, dirty, logger, host)

  const dir = `${request.cataConfig}/build`
  const ignore = ignoreFile(context, facts.engine)
  const keep = [file, ...(ignore ? [relative(context, ignore)] : [])]
  const excludes = rsyncExcludes(ignore ? readFileSync(ignore, 'utf8') : null, keep)
  if (!excludes.translated && verbose >= Verbose.NORMAL) {
    logger.step(host.name, 'the ignore file uses negations: sending the whole build context')
  }
  const [target] = resolveSshArgs(host)
  const rsyncArgs = [
    '-az',
    '--delete',
    '--delete-excluded',
    '-e',
    rsyncSshFlag(host),
    ...excludes.args,
  ]
  if (verbose >= Verbose.NORMAL) logger.step(host.name, `upload build context to ${dir}`)
  if (verbose >= Verbose.TRACE)
    logger.cmd(`rsync ${rsyncArgs.join(' ')} ${context}/ ${target}:${dir}/`)
  await ssh(host, `mkdir -p ${q(dir)}`)
  await execa('rsync', [...rsyncArgs, `${context}/`, `${target}:${dir}/`]).catch(
    (error: unknown) => {
      throw new Error(
        `[${host.name}] upload of the build context failed: ${failureOutput(error) || (error as Error).message}`,
        { cause: error }
      )
    }
  )

  const ref = releaseRef(request.release)
  const args = ['build', '-f', file, '-t', ref]
  // Podman builds OCI images by default, which drop HEALTHCHECK.
  if (facts.engine === 'podman') {
    args.push('--format', 'docker')
    warnCachedArgUses(join(context, file), logger, host)
  }
  if (options.target) args.push('--target', options.target)
  for (const [name, value] of Object.entries(options.args ?? {})) {
    args.push('--build-arg', `${name}=${value}`)
  }
  args.push('--label', `com.catapultjs.project=${project()}`, '.')

  if (verbose >= Verbose.NORMAL)
    logger.step(host.name, `build ${ref} (${facts.platform}) on the server`)
  const started = Date.now()
  const { stdout } = await ssh(
    host,
    `set -e\ncd ${q(dir)}\n${q(facts.bin)} ${args.map(q).join(' ')} 2>&1`,
    { verbose: verbose >= Verbose.TRACE }
  ).catch((error: unknown) => {
    throw new Error(
      `[${host.name}] image build failed: ${failureOutput(error) || (error as Error).message}`,
      { cause: error }
    )
  })
  if (verbose >= Verbose.DEBUG && stdout.trim()) logger.log(stdout.trim())
  if (verbose >= Verbose.NORMAL) {
    logger.step(host.name, `built in ${Math.max(1, Math.round((Date.now() - started) / 1000))}s`)
  }

  const inspect = await ssh(
    host,
    `set -e\n${q(facts.bin)} image inspect --format '{{.Id}}' ${q(ref)}\necho '--content'\n${q(facts.bin)} image inspect --format ${q(CONTENT_FORMAT)} ${q(ref)}`
  )
  const [id = '', content = ''] = inspect.stdout.split('--content\n')
  return {
    ref,
    remoteId: id.trim(),
    contentKey: contentKey(content),
    platform: facts.platform,
    revision,
    dirty,
  }
}

/** Builds the release image on a server, once per deployment and host. */
export function buildRemoteOnce(request: RemoteBuildRequest): Promise<RemoteBuildResult> {
  const key = `${request.host.name}|${request.release}`
  let pending = builds.get(key)
  if (!pending) {
    pending = build(request)
    builds.set(key, pending)
  }
  return pending
}

/** Result of the server build of this host, if it ran in this process. */
export function remoteBuilt(host: Host, release: string): Promise<RemoteBuildResult> | undefined {
  return builds.get(`${host.name}|${release}`)
}

/** Checks that rsync is available locally and on the server. */
export async function checkRemoteBuild(host: Host): Promise<void> {
  const local = await execa('rsync', ['--version'], { reject: false })
  if (local.exitCode !== 0) {
    throw new Error('rsync is required on this machine with container_build.location "remote"')
  }
  const { stdout } = await ssh(host, 'command -v rsync >/dev/null 2>&1 && echo yes || echo no')
  if (stdout.trim() !== 'yes') {
    throw new Error(
      `[${host.name}] rsync is required on the server with container_build.location "remote"`
    )
  }
}
