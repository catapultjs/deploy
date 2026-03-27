import { $ } from 'execa'
import type { Host, Paths } from './types.ts'

export function q(value: unknown): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export function getPaths(baseDir: string, releaseName: string): Paths {
  return {
    base: baseDir,
    current: `${baseDir}/current`,
    releases: `${baseDir}/releases`,
    release: `${baseDir}/releases/${releaseName}`,
    shared: `${baseDir}/shared`,
    lock: `${baseDir}/deploy.lock`,
  }
}

export async function ssh(host: Host, command: string, _opts?: { quiet?: boolean }) {
  const b64 = Buffer.from(command).toString('base64')
  return $`ssh ${host.ssh} ${"bash -lc 'echo " + b64 + "|base64 -d|bash'"}`
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
