/**
 * Removal of release images that no release directory references anymore.
 * Only images created by this project are touched: on the server, the ones recorded
 * in its registry (`.catapult/images`); locally, the ones carrying its project label.
 * Two projects sharing an image name never remove each other's images. No global
 * prune, no volume removal, no forced removal of images in use.
 */
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { q, ssh } from '../../src/utils.ts'
import { type Engine, RELEASE_PATTERN, imageName, project } from './config.ts'

const LIST_FORMAT = '{{.Repository}}:{{.Tag}}'
const REGISTRY_FILE = 'images'

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

function registryPath(cataConfig: string): string {
  return `${cataConfig}/${REGISTRY_FILE}`
}

/** Records on the server a release image created by this project. */
export async function registerImage(host: Host, cataConfig: string, ref: string): Promise<void> {
  const file = q(registryPath(cataConfig))
  await ssh(
    host,
    `set -e\ntouch ${file}\ngrep -qxF ${q(ref)} ${file} || printf '%s\\n' ${q(ref)} >> ${file}`
  )
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Removes the images this project created for releases whose directory is gone. */
export async function cleanupRemote(
  host: Host,
  bin: string,
  paths: { releases: string; cataConfig: string },
  logger: CatapultLogger
): Promise<string[]> {
  const registry = registryPath(paths.cataConfig)
  const { stdout } = await ssh(
    host,
    `set -e
ls -1 ${q(paths.releases)} 2>/dev/null || true
echo '--registry'
cat ${q(registry)} 2>/dev/null || true`
  )
  const [releasesPart = '', registryPart = ''] = stdout.split('--registry')
  const kept = new Set(lines(releasesPart))
  const registered = lines(registryPart)
  const stale = registered.filter((ref) => {
    const tag = ref.slice(ref.lastIndexOf(':') + 1)
    return RELEASE_PATTERN.test(tag) && !kept.has(tag)
  })
  if (!stale.length) return []

  const { stdout: results } = await ssh(
    host,
    `set +e
${stale
  .map((ref) => {
    const image = q(ref)
    return `if ${q(bin)} image inspect ${image} >/dev/null 2>&1; then ${q(bin)} rmi ${image} >/dev/null 2>&1 && echo removed ${image} || echo failed ${image}; else echo gone ${image}; fi`
  })
  .join('\n')}
true`
  )

  const removed: string[] = []
  const dropped = new Set<string>()
  for (const line of lines(results)) {
    const [status, ref] = [line.slice(0, line.indexOf(' ')), line.slice(line.indexOf(' ') + 1)]
    if (status === 'removed') removed.push(ref)
    if (status === 'removed' || status === 'gone') dropped.add(ref)
    if (status === 'failed') {
      logger.warning(`could not remove ${ref} (still in use?)`, { prefix: host.name })
    }
  }

  if (dropped.size) {
    const remaining = registered.filter((ref) => !dropped.has(ref))
    const content = remaining.map((ref) => `${ref}\n`).join('')
    await ssh(
      host,
      `set -e\nprintf '%s' ${q(content)} > ${q(`${registry}.tmp`)}\nmv ${q(`${registry}.tmp`)} ${q(registry)}`
    )
  }
  return removed
}

/** Keeps the newest local release images of this project (and the current one). */
export async function cleanupLocal(
  engine: Engine,
  release: string,
  keep: number,
  logger: CatapultLogger
): Promise<string[]> {
  const repository = `localhost/${imageName()}`
  const listing = await execa(
    engine,
    [
      'images',
      '--filter',
      `label=com.catapultjs.project=${project()}`,
      '--format',
      LIST_FORMAT,
      repository,
    ],
    { reject: false }
  )
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
