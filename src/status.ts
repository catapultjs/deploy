import type { Host, DeployContext } from './types.ts'
import type { CatapultLogger } from './logger.ts'
import { getCurrentRelease } from './deployer.ts'
import { bin } from './task.ts'
import { getPipeline } from './pipeline.ts'
import { hooks } from './pipeline/hooks.ts'
import { q, getPaths, ssh, detectPackageManager } from './utils.ts'

export interface HostStatus {
  name: string
  release?: string | null
  health?: 'ok' | 'fail'
  node?: string | null
  packageManager?: { name: string; version: string | null }
  revision?: Record<string, unknown>
  lock?: string | null
  error?: string
  [key: string]: unknown
}

/** Built-in HostStatus fields — anything else comes from onStatus hooks. */
export const HOST_STATUS_FIELDS = new Set([
  'name',
  'release',
  'health',
  'node',
  'packageManager',
  'revision',
  'lock',
  'error',
])

/**
 * Collects the status of a single host. SSH errors are captured in the
 * `error` field instead of being thrown. `onStatus` hooks receive
 * `hookLogger` for free-form output; data they return is merged into the
 * result.
 */
export async function collectHostStatus(
  ctx: DeployContext,
  host: Host,
  hookLogger: CatapultLogger
): Promise<HostStatus> {
  const paths = getPaths(host.deployPath, ctx.release)
  const pm = ctx.config.packageManager ?? (await detectPackageManager())
  const status: HostStatus = { name: host.name }

  try {
    status.release = (await getCurrentRelease(ctx, host)) ?? null

    if (getPipeline().includes('deploy:healthcheck')) {
      try {
        await ssh(
          host,
          `set -e\n${bin('curl')} --fail --silent --show-error --max-time 5 ${q(host.healthcheck?.url)} >/dev/null`
        )
        status.health = 'ok'
      } catch {
        status.health = 'fail'
      }
    }

    const { stdout: versionsStdout } = await ssh(
      host,
      `set +e\ncd ${q(paths.current)}\necho "NODE:$(${bin('node')} --version 2>/dev/null || true)"\necho "PM:$(${bin(pm)} --version 2>/dev/null || true)"`
    )
    const lines = versionsStdout.trim().split('\n')
    status.node = lines.find((l) => l.startsWith('NODE:'))?.slice(5) || null
    status.packageManager = {
      name: pm,
      version: lines.find((l) => l.startsWith('PM:'))?.slice(3) || null,
    }

    for (const hook of hooks.getStatus()) {
      const data = await hook(ctx, host, hookLogger)
      if (data) Object.assign(status, data)
    }

    const { stdout: revStdout } = await ssh(
      host,
      `set +e\n[ -f ${q(paths.cataConfig + '/revisions.log')} ] && tail -1 ${q(paths.cataConfig + '/revisions.log')} || true`
    )
    const rev = revStdout.trim()
    if (rev) {
      try {
        status.revision = JSON.parse(rev)
      } catch {}
    }

    const { stdout: lockStdout } = await ssh(
      host,
      `set +e\n[ -f ${q(paths.lock)} ] && cat ${q(paths.lock)} || true`
    )
    status.lock = lockStdout.trim() || null
  } catch (error) {
    status.error = (error as Error).message
  }

  return status
}
