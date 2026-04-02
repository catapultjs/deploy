import { $ } from 'execa'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { colors } from '@poppinss/cliui'
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
  if (opts?.verbose && !opts?.quiet) console.log(colors.ansi().yellow(`    $ ${command}`))
  const b64 = Buffer.from(command).toString('base64')
  const args = [...sshControlArgs(host), ...resolveSshArgs(host)]

  return $`ssh ${args} ${"bash -lc 'echo " + b64 + "|base64 -d|bash'"}`
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
