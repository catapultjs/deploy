/**
 * OCI foundation shared by the container recipes (compose, container, quadlet):
 * engine checks, local build, SSH transfer, release manifest and image cleanup.
 * Internal: imported by those recipes, not a public API yet.
 */
import type {} from '../../src/types.ts'
import {
  type TaskContext,
  task,
  desc,
  get,
  onSetup,
  onStatus,
  onBeforeRollback,
} from '../../index.ts'
import { getPaths } from '../../src/utils.ts'
import { Verbose } from '../../src/enums.ts'
import {
  buildOptions,
  compression,
  imageName,
  keepLocal,
  project,
  releaseRef,
  sourceImage,
  transferMode,
} from './config.ts'
import { checkHost, hostFacts } from './engine.ts'
import { buildOnce, builtImage, revisionInfo } from './build.ts'
import { pullSource, remoteImageId, remoteTag, streamImage } from './transfer.ts'
import {
  MANIFEST_FILE,
  type ManifestImage,
  manifestExtras,
  readManifest,
  writeManifest,
} from './manifest.ts'
import { cleanupLocal, cleanupRemote } from './cleanup.ts'

declare module '../../src/types.ts' {
  interface TaskRegistry {
    'oci:check': true
    'oci:build': true
    'oci:transfer': true
    'oci:cleanup': true
  }
}

const locallyCleaned = new Set<string>()

function verbosity(config: TaskContext['config']): number {
  return config.verbose ?? Verbose.SILENT
}

onSetup(async (_ctx, host, logger) => {
  const facts = await checkHost(host, logger)
  logger.step(host.name, `${facts.version} (${facts.platform})`)
})

onStatus(async (_ctx, host, logger) => {
  try {
    const facts = await checkHost(host, logger)
    return { container: `${facts.version} (${facts.platform})` }
  } catch {
    return { container: 'unavailable' }
  }
})

onBeforeRollback(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  const manifest = await readManifest(host, paths.release)
  if (!manifest) {
    throw new Error(
      `[${host.name}] release ${ctx.release} has no ${MANIFEST_FILE}: it cannot be restored`
    )
  }
  const facts = await hostFacts(host, logger)
  for (const image of manifest.images) {
    if (!(await remoteImageId({ host, facts, logger, verbose: 0 }, image.ref))) {
      throw new Error(
        `[${host.name}] image ${image.ref} of release ${ctx.release} is missing on the server`
      )
    }
  }
})

desc('Checks the container engine and configuration on the server')
task('oci:check', async ({ host, config, logger }: TaskContext) => {
  project()
  imageName()
  transferMode()
  compression()
  buildOptions()
  sourceImage()
  const facts = await checkHost(host, logger)
  if (verbosity(config) >= Verbose.NORMAL) {
    logger.step(host.name, `${facts.version} (${facts.platform})`)
  }
})

desc('Builds the release image locally, once for all hosts')
task('oci:build', async ({ host, config, logger, release }: TaskContext) => {
  if (sourceImage()) return
  const facts = await hostFacts(host, logger)
  const options = buildOptions()
  if (options.platform && options.platform !== facts.platform) {
    throw new Error(
      `[${host.name}] container_build.platform is ${options.platform} but the server runs ${facts.platform}`
    )
  }
  await buildOnce({
    release,
    platform: facts.platform,
    serverEngine: facts.engine,
    logger,
    verbose: verbosity(config),
    host,
  })
})

desc('Transfers the release image to the server and writes the release manifest')
task('oci:transfer', async ({ host, config, logger, release, paths }: TaskContext) => {
  transferMode()
  const facts = await hostFacts(host, logger)
  const verbose = verbosity(config)
  const ctx = { host, facts, logger, verbose }
  const ref = releaseRef(release)
  const source = sourceImage()
  let image: ManifestImage
  let revision: string | null
  let dirty: boolean

  if (source) {
    await pullSource(ctx, source, ref)
    const remoteId = await remoteImageId(ctx, ref)
    if (!remoteId) throw new Error(`[${host.name}] ${ref} not found after pulling ${source}`)
    image = { ref, localId: null, remoteId, platform: facts.platform, source }
    ;({ revision, dirty } = await revisionInfo())
  } else {
    const pending = builtImage(release)
    if (!pending) throw new Error('oci:build must run before oci:transfer')
    const built = await pending
    let remoteId = await remoteImageId(ctx, ref)

    if (remoteId) {
      if (verbose >= Verbose.NORMAL) logger.step(host.name, `${ref} already on the server`)
    } else {
      const currentManifest = await readManifest(host, paths.current)
      const previous = currentManifest?.images.find(
        (candidate) => candidate.localId === built.localId && candidate.ref !== ref
      )
      if (previous && (await remoteImageId(ctx, previous.ref))) {
        if (verbose >= Verbose.NORMAL) {
          logger.step(host.name, `image unchanged since ${previous.ref}, tagging without transfer`)
        }
        await remoteTag(ctx, previous.ref, ref)
      } else {
        await streamImage(ctx, built.engine, ref, compression())
      }
      remoteId = await remoteImageId(ctx, ref)
      if (!remoteId) throw new Error(`[${host.name}] ${ref} not found on the server after transfer`)
    }

    image = { ref, localId: built.localId, remoteId, platform: built.platform }
    revision = built.revision
    dirty = built.dirty
  }

  await writeManifest(host, paths.release, {
    ...manifestExtras(host.name, release),
    schemaVersion: 1,
    release,
    recipe: get<string>('oci_recipe', 'oci'),
    engine: facts.engine,
    revision,
    dirty,
    createdAt: new Date().toISOString(),
    images: [image],
  })
})

desc('Removes release images no longer referenced by a release, on the server and locally')
task('oci:cleanup', async ({ host, config, logger, release, paths }: TaskContext) => {
  // A failed cleanup must not roll back a healthy release: warn instead.
  try {
    const facts = await hostFacts(host, logger)
    const removed = await cleanupRemote(host, facts.bin, paths.releases, logger)
    if (removed.length && verbosity(config) >= Verbose.NORMAL) {
      logger.step(host.name, `removed ${removed.length} old image(s)`)
    }

    const pending = builtImage(release)
    if (pending && !locallyCleaned.has(release)) {
      locallyCleaned.add(release)
      const built = await pending
      await cleanupLocal(built.engine, release, keepLocal(), logger)
    }
  } catch (error) {
    logger.warning(`image cleanup failed: ${(error as Error).message}`, { prefix: host.name })
  }
})
