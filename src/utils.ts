import type { Host, Paths } from './types.ts'
import { $ } from 'execa'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { access } from 'node:fs/promises'
import { colors } from '@poppinss/cliui'

const DEPLOY_CANDIDATES = ['deploy.ts', 'deploy.js', 'bin/deploy.ts', 'bin/deploy.js']

const PM_LOCK_FILES: [string, string][] = [
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
]

export const yellow = (s: string) => colors.ansi().yellow(s)
export const blue = (s: string) => colors.ansi().blue(s)
export const gray = (s: string) => colors.ansi().dim(s)

/** Detects the package manager by checking for lock files in the given directory. */
export async function detectPackageManager(cwd = process.cwd()): Promise<string> {
  for (const [lockFile, manager] of PM_LOCK_FILES) {
    try {
      await access(resolve(cwd, lockFile))
      return manager
    } catch {}
  }
  return 'npm'
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
    lock: `${baseDir}/deploy.lock`,
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
  return ['-o', 'ControlMaster=auto', '-o', `ControlPath=${socket}`, '-o', 'ControlPersist=60']
}

/** Returns the -e flag value for rsync, reusing the SSH multiplexing socket. */
export function rsyncSshFlag(host: Host): string {
  const controlOpts = sshControlArgs(host).join(' ')
  const port = typeof host.ssh === 'object' && host.ssh.port ? ` -p ${host.ssh.port}` : ''
  return `ssh${port} ${controlOpts}`
}

export async function ssh(
  host: Host,
  command: string,
  opts?: { quiet?: boolean; verbose?: boolean }
) {
  if (opts?.verbose && !opts?.quiet) console.log(yellow(`    $ ${command}`))
  const b64 = Buffer.from(command).toString('base64')
  const args = [...sshControlArgs(host), ...resolveSshArgs(host)]

  return $`ssh ${args} ${"bash -lc 'echo " + b64 + "|base64 -d|bash'"}`
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
