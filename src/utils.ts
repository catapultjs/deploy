import type { Host, Paths } from './types.ts'
import { PackageManager } from './enums.ts'
import { $ } from 'execa'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { access } from 'node:fs/promises'
import { logger } from './logger.ts'

const DEPLOY_CANDIDATES = ['deploy.ts', 'deploy.js']

const PM_LOCK_FILES: [string, PackageManager][] = [
  ['bun.lock', PackageManager.Bun],
  ['bun.lockb', PackageManager.Bun],
  ['pnpm-lock.yaml', PackageManager.Pnpm],
  ['yarn.lock', PackageManager.Yarn],
  ['package-lock.json', PackageManager.Npm],
]

/** Detects the package manager by checking for lock files in the given directory. */
export async function detectPackageManager(cwd = process.cwd()): Promise<PackageManager> {
  for (const [lockFile, manager] of PM_LOCK_FILES) {
    try {
      await access(resolve(cwd, lockFile))
      return manager
    } catch {}
  }
  return PackageManager.Npm
}

/** Returns the path of the first existing deploy config file, or null if none found. */
export async function findDeployFile(cwd = process.cwd()): Promise<string | null> {
  for (const candidate of DEPLOY_CANDIDATES) {
    const full = resolve(cwd, candidate)
    try {
      await access(full)
      return full
    } catch {}
  }
  return null
}

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
    cataConfig: `${baseDir}/.catapult`,
    repo: `${baseDir}/.catapult/repo`,
    builder: `${baseDir}/.catapult/builder`,
    lock: `${baseDir}/.catapult/deploy.lock`,
  }
}

export function resolveSshArgs(host: Host): string[] {
  if (typeof host.ssh === 'string') return [host.ssh]
  const { user, host: h, port } = host.ssh
  return port ? ['-p', String(port), `${user}@${h}`] : [`${user}@${h}`]
}

export function sshControlArgs(host: Host): string[] {
  const target = typeof host.ssh === 'string' ? host.ssh : `${host.ssh.user}@${host.ssh.host}`
  const hash = createHash('sha1').update(target).digest('hex').slice(0, 8)
  const socket = join(tmpdir(), `cata-${hash}.sock`)
  return ['-o', 'ControlMaster=auto', '-o', `ControlPath=${socket}`, '-o', 'ControlPersist=300']
}

/** Returns the -e flag value for rsync, reusing the SSH multiplexing socket. */
export function rsyncSshFlag(host: Host): string {
  const controlOpts = sshControlArgs(host).join(' ')
  const port = typeof host.ssh === 'object' && host.ssh.port ? ` -p ${host.ssh.port}` : ''
  return `ssh${port} ${controlOpts}`
}

export function ssh(
  host: Host,
  command: string,
  opts?: { quiet?: boolean; verbose?: boolean; color?: boolean }
) {
  if (opts?.verbose && !opts?.quiet) logger.cmd(command)
  const cmd = opts?.color ? `export FORCE_COLOR=1\n${command}` : command
  const b64 = Buffer.from(cmd).toString('base64')
  const args = [...sshControlArgs(host), ...resolveSshArgs(host)]

  return $`ssh ${args} ${"bash -lc 'echo " + b64 + "|base64 -d|bash'"}`
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

export function elapsed(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
