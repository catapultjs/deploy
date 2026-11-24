/**
 * Removal of release images that no release directory references anymore.
 * Only tags of the project repository named like Catapult releases are touched:
 * no global prune, no volume removal, no forced removal of images in use.
 */
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { q, ssh } from '../../src/utils.ts'
import { type Engine, RELEASE_PATTERN, imageName } from './config.ts'

const LIST_FORMAT = '{{.Repository}}:{{.Tag}}'

/** Release tags of the project repository found in an `images` listing. */
export function releaseTags(listing: string): string[] {
  const prefix = `localhost/${imageName()}:`
  return [
    ...new Set(
      listing
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith(prefix))
        .map((line) => line.slice(prefix.length))
        .filter((tag) => RELEASE_PATTERN.test(tag))
    ),
  ]
}

/** Removes server tags whose release directory no longer exists. */
export async function cleanupRemote(
  host: Host,
  bin: string,
  releasesPath: string,
  logger: CatapultLogger
): Promise<string[]> {
  const repository = `localhost/${imageName()}`
  const { stdout } = await ssh(
    host,
    `set -e
echo '--releases'
ls -1 ${q(releasesPath)} 2>/dev/null || true
echo '--images'
${q(bin)} images --format ${q(LIST_FORMAT)} ${q(repository)}`
  )
  const [releasesPart = '', imagesPart = ''] = stdout.split('--images')
  const kept = new Set(
    releasesPart
      .replace('--releases', '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  )
  const stale = releaseTags(imagesPart).filter((tag) => !kept.has(tag))
  if (!stale.length) return []

  const { stdout: failures } = await ssh(
    host,
    `set +e
${stale
  .map((tag) => {
    const ref = `${repository}:${tag}`
    return `${q(bin)} rmi ${q(ref)} >/dev/null 2>&1 || echo ${q(ref)}`
  })
  .join('\n')}
true`
  )
  for (const ref of failures.split('\n').filter(Boolean)) {
    logger.warning(`could not remove ${ref} (still in use?)`, { prefix: host.name })
  }
  return stale
}

/** Keeps the newest local release tags (and the current one), removes the others. */
export async function cleanupLocal(
  engine: Engine,
  release: string,
  keep: number,
  logger: CatapultLogger
): Promise<string[]> {
  const repository = `localhost/${imageName()}`
  const listing = await execa(engine, ['images', '--format', LIST_FORMAT, repository], {
    reject: false,
  })
  if (listing.exitCode !== 0) return []
  const tags = releaseTags(listing.stdout).sort().reverse()
  const kept = new Set([release, ...tags.slice(0, keep)])
  const stale = tags.filter((tag) => !kept.has(tag))
  for (const tag of stale) {
    const result = await execa(engine, ['rmi', `${repository}:${tag}`], { reject: false })
    if (result.exitCode !== 0) logger.warning(`could not remove local image ${repository}:${tag}`)
  }
  return stale
}
