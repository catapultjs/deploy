/**
 * Image distribution to the servers. Internal to the container recipes.
 */
import { PassThrough, type Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import zlib from 'node:zlib'
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { Verbose } from '../../src/enums.ts'
import { q, ssh, sshPipe } from '../../src/utils.ts'
import { type Compression, type Engine } from './config.ts'
import type { RemoteFacts } from './engine.ts'

interface Context {
  host: Host
  facts: RemoteFacts
  logger: CatapultLogger
  verbose: number
}

/** Image ID on the server, or null when the reference does not exist there. */
export async function remoteImageId(ctx: Context, ref: string): Promise<string | null> {
  const { stdout } = await ssh(
    ctx.host,
    `set +e\n${q(ctx.facts.bin)} image inspect --format '{{.Id}}' ${q(ref)} 2>/dev/null || true`
  )
  return stdout.trim() || null
}

export async function remoteTag(ctx: Context, source: string, target: string): Promise<void> {
  await ssh(ctx.host, `set -e\n${q(ctx.facts.bin)} tag ${q(source)} ${q(target)}`)
}

/** Pulls `source` on the server when missing, then tags it as the release reference. */
export async function pullSource(ctx: Context, source: string, ref: string): Promise<void> {
  if (ctx.verbose >= Verbose.NORMAL) ctx.logger.step(ctx.host.name, `pull ${source}`)
  const bin = q(ctx.facts.bin)
  await ssh(
    ctx.host,
    `set -e
${bin} image inspect ${q(source)} >/dev/null 2>&1 || ${bin} pull ${q(source)}
${bin} tag ${q(source)} ${q(ref)}`
  )
}

function compressor(mode: Compression): Transform | null {
  if (mode === 'none') return null
  if (mode === 'gzip') return zlib.createGzip({ level: 6 })
  const createZstd = (zlib as unknown as { createZstdCompress?: () => Transform })
    .createZstdCompress
  if (!createZstd) throw new Error('container_compression "zstd" requires zstd support in Node.js')
  return createZstd()
}

function decompressCommand(mode: Compression): string {
  if (mode === 'gzip') return 'gzip -dc | '
  if (mode === 'zstd') return 'zstd -dc | '
  return ''
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Streams `<engine> save` into `<engine> load` on the server over SSH, compressed
 * on the fly, without writing an archive on either side. Errors from the local save,
 * the compression or the remote load stop the transfer.
 */
export async function streamImage(
  ctx: Context,
  localEngine: Engine,
  ref: string,
  mode: Compression
): Promise<number> {
  const saveArgs =
    localEngine === 'podman' ? ['save', '--format', 'docker-archive', ref] : ['save', ref]
  if (ctx.verbose >= Verbose.TRACE) ctx.logger.cmd(`${localEngine} ${saveArgs.join(' ')}`)

  const save = execa(localEngine, saveArgs, { buffer: { stdout: false } })
  // Awaited in archive(); this handler only avoids an unhandled rejection when the
  // transfer stops before reaching that point (the save is then killed).
  save.catch(() => {})
  const output = compressor(mode) ?? new PassThrough()
  const started = Date.now()
  let bytes = 0

  async function* archive() {
    const piping = pipeline(save.stdout!, output)
    piping.catch(() => {})
    let lastReport = Date.now()
    for await (const chunk of output) {
      bytes += chunk.length
      if (ctx.verbose >= Verbose.NORMAL && Date.now() - lastReport >= 10_000) {
        ctx.logger.step(ctx.host.name, `transferring ${megabytes(bytes)}`)
        lastReport = Date.now()
      }
      yield chunk
    }
    await piping
    // Surfaces a failed save even when it closed its output cleanly.
    await save
  }

  if (ctx.verbose >= Verbose.NORMAL) ctx.logger.step(ctx.host.name, `transfer ${ref} over SSH`)
  try {
    await sshPipe(
      ctx.host,
      `set -eo pipefail\n${decompressCommand(mode)}${q(ctx.facts.bin)} load`,
      archive(),
      { verbose: ctx.verbose >= Verbose.TRACE }
    )
  } finally {
    save.kill()
  }

  if (ctx.verbose >= Verbose.NORMAL) {
    const seconds = Math.max(1, Math.round((Date.now() - started) / 1000))
    ctx.logger.step(ctx.host.name, `transferred ${megabytes(bytes)} in ${seconds}s`)
  }
  return bytes
}
