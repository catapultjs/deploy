import type { Host, Paths } from './types.ts'
import { PackageManager } from './enums.ts'
import { $ } from 'execa'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { access } from 'node:fs/promises'
import { logger } from './logger.ts'

const DEPLOY_CANDIDATES = [
  'deploy.ts',
  'deploy.config.ts',
  'deploy.js',
  'deploy.config.js',
  'deploy.config.json',
  'deploy.json',
]

const PM_LOCK_FILES: [string, PackageManager][] = [
  ['bun.lock', PackageManager.BUN],
  ['bun.lockb', PackageManager.BUN],
  ['pnpm-lock.yaml', PackageManager.PNPM],
  ['yarn.lock', PackageManager.YARN],
  ['package-lock.json', PackageManager.NPM],
]

export async function getPackageLockFileName(cwd = process.cwd()): Promise<string | false> {
  for (const [lockFile] of PM_LOCK_FILES) {
    try {
      await access(resolve(cwd, lockFile))
      return lockFile
    } catch {}
  }
  return false
}

/** Detects the package manager by checking for lock files in the given directory. */
export async function detectPackageManager(cwd = process.cwd()): Promise<PackageManager> {
  for (const [lockFile, manager] of PM_LOCK_FILES) {
    try {
      await access(resolve(cwd, lockFile))
      return manager
    } catch {}
  }
  return PackageManager.NPM
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
    lock: `${baseDir}/.catapult/deploy.lock`,
  }
}

/**
 * Returns the `-i <path>` args when the host declares a private key file, together
 * with `IdentitiesOnly=yes` so that key is used exclusively — ssh will not fall back
 * to the agent's other identities nor to default `~/.ssh/id_*` files.
 */
export function identityArgs(host: Host): string[] {
  return typeof host.ssh === 'object' && host.ssh.identityFile
    ? ['-i', host.ssh.identityFile, '-o', 'IdentitiesOnly=yes']
    : []
}

/**
 * Whether to use SSH connection multiplexing for this host. Honors an explicit
 * `host.multiplexing`, otherwise auto-detects: off on Windows (native OpenSSH
 * has no ControlPath socket support), on elsewhere.
 */
export function useMultiplexing(host: Host): boolean {
  if (typeof host.multiplexing === 'boolean') return host.multiplexing
  return process.platform !== 'win32'
}

export function resolveSshArgs(host: Host): string[] {
  if (typeof host.ssh === 'string') return [host.ssh]
  const { user, host: h, port } = host.ssh
  const args: string[] = []
  if (port) args.push('-p', String(port))
  args.push(...identityArgs(host))
  args.push(`${user}@${h}`)
  return args
}

export function sshControlArgs(host: Host): string[] {
  if (!useMultiplexing(host)) return []
  const target = typeof host.ssh === 'string' ? host.ssh : `${host.ssh.user}@${host.ssh.host}`
  const hash = createHash('sha1').update(target).digest('hex').slice(0, 8)
  const socket = join(tmpdir(), `cata-${hash}.sock`)
  return ['-o', 'ControlMaster=auto', '-o', `ControlPath=${socket}`, '-o', 'ControlPersist=300']
}

export function scpArgs(host: Host): string[] {
  const portArgs =
    typeof host.ssh === 'object' && host.ssh.port ? ['-P', String(host.ssh.port)] : []
  return [...portArgs, ...identityArgs(host), ...sshControlArgs(host)]
}

export function scpTarget(host: Host): string {
  if (typeof host.ssh === 'string') return host.ssh
  return `${host.ssh.user}@${host.ssh.host}`
}

export function resolveHostStringValue(value: unknown, host: Host, key: string): string {
  if (typeof value === 'string') return value

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const resolved = (value as Record<string, unknown>)[host.name]
    if (typeof resolved === 'string') return resolved
  }

  throw new Error(`[${host.name}] ${key} must be a string or an object keyed by host name`)
}

/** Returns the -e flag value for rsync, reusing the SSH multiplexing socket. */
export function rsyncSshFlag(host: Host): string {
  const parts = ['ssh']
  if (typeof host.ssh === 'object' && host.ssh.port) parts.push('-p', String(host.ssh.port))
  parts.push(...identityArgs(host), ...sshControlArgs(host))
  return parts.join(' ')
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

/**
 * True when an execa SSH failure is a transport/auth error — ssh's own exit code
 * `255`, or the process failing before it produced an exit code — rather than a
 * non-zero exit coming from the remote command itself (e.g. a failed test).
 */
export function isSshConnectionError(error: unknown): boolean {
  const code = (error as { exitCode?: number } | null | undefined)?.exitCode
  return code == null || code === 255
}

/** Extracts a concise message from an execa error, preferring the SSH stderr. */
export function sshErrorMessage(error: unknown): string {
  const e = error as { stderr?: unknown; shortMessage?: string; message?: string }
  const stderr = typeof e?.stderr === 'string' ? e.stderr.trim() : ''
  return stderr || e?.shortMessage || e?.message || String(error)
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
