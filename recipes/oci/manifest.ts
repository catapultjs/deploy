/**
 * Release manifest (`release.json`) describing the images of a release.
 * Internal to the container recipes. Never store secrets in it.
 */
import type { Host } from '../../src/types.ts'
import { q, ssh } from '../../src/utils.ts'
import type { Engine } from './config.ts'

export const MANIFEST_FILE = 'release.json'

export interface ManifestImage {
  /** Reference used on the server, e.g. localhost/app:2026-11-25T10-20-30-123Z. */
  ref: string
  /** Image ID on the build machine; null for a source image pulled on the server. */
  localId: string | null
  /** Content hash of the local image (layers and config), used to skip unchanged transfers. */
  contentKey?: string
  /** Image ID on the server. Compare IDs from the same side only. */
  remoteId: string
  platform: string
  /** Image the release was tagged from, when `container_source` is used. */
  source?: string
  /** Immutable registry reference (repository@digest) with `container_transfer: registry`. */
  registryRef?: string
}

export interface Manifest {
  schemaVersion: 1
  release: string
  recipe: string
  engine: Engine
  revision: string | null
  dirty: boolean
  createdAt: string
  images: ManifestImage[]
  [key: string]: unknown
}

const extras = new Map<string, Record<string, unknown>>()

/**
 * Adds recipe data (e.g. compose files and services) to the manifest written by
 * `oci:transfer` for this host and release. Never pass secrets.
 */
export function setManifestExtra(hostName: string, release: string, key: string, value: unknown) {
  const id = `${hostName}|${release}`
  extras.set(id, { ...extras.get(id), [key]: value })
}

export function manifestExtras(hostName: string, release: string): Record<string, unknown> {
  return extras.get(`${hostName}|${release}`) ?? {}
}

/** Reads the manifest of a release directory, or null when absent or unreadable. */
export async function readManifest(host: Host, releasePath: string): Promise<Manifest | null> {
  const { stdout } = await ssh(
    host,
    `set +e\ncat ${q(`${releasePath}/${MANIFEST_FILE}`)} 2>/dev/null || true`
  )
  if (!stdout.trim()) return null
  try {
    const manifest = JSON.parse(stdout)
    return manifest?.schemaVersion === 1 && Array.isArray(manifest.images) ? manifest : null
  } catch {
    return null
  }
}

/** Writes the manifest atomically, readable by the deploy user only. */
export async function writeManifest(
  host: Host,
  releasePath: string,
  manifest: Manifest
): Promise<void> {
  const file = `${releasePath}/${MANIFEST_FILE}`
  await ssh(
    host,
    `set -e
umask 077
printf '%s\\n' ${q(JSON.stringify(manifest, null, 2))} > ${q(`${file}.tmp`)}
mv ${q(`${file}.tmp`)} ${q(file)}`
  )
}
