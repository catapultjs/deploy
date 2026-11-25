/**
 * Image distribution through a container registry: the release image is pushed once
 * from the build machine and pulled by digest on each server. Internal to the
 * container recipes.
 */
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { Verbose } from '../../src/enums.ts'
import { q, sshPipe } from '../../src/utils.ts'
import { type Engine, type RegistryCredentials, registryHost } from './config.ts'
import type { RemoteFacts } from './engine.ts'
import { failureOutput } from './output.ts'

export interface PushResult {
  /** Immutable reference pulled by the servers, e.g. ghcr.io/acme/app@sha256:... */
  registryRef: string
}

const pushes = new Map<string, Promise<PushResult>>()

/** `repository@sha256:...` from `RepoDigests`, else from the push output. */
export function pushedDigest(repository: string, repoDigests: string, pushOutput: string) {
  try {
    const digests = JSON.parse(repoDigests) as unknown
    if (Array.isArray(digests)) {
      const match = digests.find(
        (item): item is string => typeof item === 'string' && item.startsWith(`${repository}@`)
      )
      if (match) return match
    }
  } catch {}
  const digest = /digest: (sha256:[a-f0-9]{64})/.exec(pushOutput)?.[1]
  return digest ? `${repository}@${digest}` : null
}

async function push(
  engine: Engine,
  localRef: string,
  repository: string,
  release: string,
  logger: CatapultLogger,
  verbose: number,
  hostName: string
): Promise<PushResult> {
  const remoteTag = `${repository}:${release}`
  if (verbose >= Verbose.NORMAL) logger.step(hostName, `push ${remoteTag}`)
  await execa(engine, ['tag', localRef, remoteTag])
  try {
    const pushed = await execa(engine, ['push', remoteTag], { all: true }).catch(
      (error: unknown) => {
        throw new Error(
          `push of ${remoteTag} failed: ${failureOutput(error) || (error as Error).message}. Log in to the registry on this machine first (${engine} login ${registryHost(repository)})`,
          { cause: error }
        )
      }
    )
    const inspect = await execa(
      engine,
      ['image', 'inspect', '--format', '{{json .RepoDigests}}', remoteTag],
      { reject: false }
    )
    const registryRef = pushedDigest(repository, inspect.stdout, pushed.all ?? '')
    if (!registryRef) throw new Error(`could not read the digest of ${remoteTag} after the push`)
    return { registryRef }
  } finally {
    // The local release tag (localhost/...) keeps the image: drop the registry tag.
    await execa(engine, ['rmi', remoteTag], { reject: false })
  }
}

/** Pushes the release image once per deployment, whatever the number of hosts. */
export function pushOnce(
  engine: Engine,
  localRef: string,
  repository: string,
  release: string,
  logger: CatapultLogger,
  verbose: number,
  hostName: string
): Promise<PushResult> {
  let pending = pushes.get(release)
  if (!pending) {
    pending = push(engine, localRef, repository, release, logger, verbose, hostName)
    pushes.set(release, pending)
  }
  return pending
}

interface PullContext {
  host: Host
  facts: RemoteFacts
  logger: CatapultLogger
  verbose: number
}

/**
 * Pulls `registryRef` on the server and tags it as the release reference. With
 * credentials, logs in with a temporary auth file removed afterwards: the password
 * goes through stdin, never in a command line, and nothing stays on the server.
 */
export async function pullImage(
  ctx: PullContext,
  registryRef: string,
  ref: string,
  credentials: RegistryCredentials | null
): Promise<void> {
  const bin = q(ctx.facts.bin)
  const repository = registryRef.slice(0, registryRef.indexOf('@'))
  const host = registryHost(repository)
  // Docker reads credentials from a config directory, Podman from an auth file.
  const auth = ctx.facts.engine === 'docker' ? '--config "$tmp"' : '--authfile "$tmp/auth.json"'
  const script = credentials
    ? `set -eo pipefail
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
${ctx.facts.engine === 'docker' ? `${bin} ${auth} login` : `${bin} login ${auth}`} --username ${q(credentials.username)} --password-stdin ${q(host)} >/dev/null
${ctx.facts.engine === 'docker' ? `${bin} ${auth} pull` : `${bin} pull ${auth}`} ${q(registryRef)} >/dev/null
${bin} tag ${q(registryRef)} ${q(ref)}`
    : `set -eo pipefail
${bin} pull ${q(registryRef)} >/dev/null
${bin} tag ${q(registryRef)} ${q(ref)}`

  if (ctx.verbose >= Verbose.NORMAL) ctx.logger.step(ctx.host.name, `pull ${registryRef}`)
  async function* input() {
    if (credentials) yield credentials.password
  }
  try {
    await sshPipe(ctx.host, script, input(), { verbose: ctx.verbose >= Verbose.TRACE })
  } catch (error) {
    throw new Error(
      `[${ctx.host.name}] pull of ${registryRef} failed: ${failureOutput(error) || (error as Error).message}`,
      { cause: error }
    )
  }
}
