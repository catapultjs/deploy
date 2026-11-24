/**
 * Waits for containers to be running and healthy. Internal to the container recipes.
 */
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { Verbose } from '../../src/enums.ts'
import { q, sleep, ssh } from '../../src/utils.ts'
import type { RemoteFacts } from './engine.ts'

export type ContainerState = 'ok' | 'pending' | 'failed'

export interface ContainerInfo {
  name: string
  state: string
  status: string
}

/** Classifies `ps` State/Status values, identical for Docker and Podman. */
export function containerState(state: string, status: string): ContainerState {
  const lowered = `${state} ${status}`.toLowerCase()
  if (lowered.includes('unhealthy')) return 'failed'
  if (state === 'running') return /\((health: )?starting\)/i.test(status) ? 'pending' : 'ok'
  if (state === 'exited') return /exited \(0\)/i.test(status) ? 'ok' : 'failed'
  if (state === 'created' || state === 'restarting' || state === 'configured') return 'pending'
  return 'failed'
}

/**
 * Lists containers matching any of the label filter sets. Labels of one set must
 * all match (`key=value` each).
 */
export async function listContainers(
  host: Host,
  facts: RemoteFacts,
  filterSets: string[][]
): Promise<ContainerInfo[]> {
  if (!filterSets.length) return []
  const script = filterSets
    .map((labels) => {
      const filters = labels.map((label) => `--filter ${q(`label=${label}`)}`).join(' ')
      return `${q(facts.bin)} ps -a ${filters} --format '{{.Names}}\t{{.State}}\t{{.Status}}'`
    })
    .join('\n')
  const { stdout } = await ssh(host, `set -e\n${script}`)
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name = '', state = '', status = ''] = line.split('\t')
      return { name, state: state.trim().toLowerCase(), status: status.trim() }
    })
}

export interface WaitOptions {
  host: Host
  facts: RemoteFacts
  filterSets: string[][]
  timeoutSeconds: number
  logger: CatapultLogger
  verbose: number
  /** Task suggested to read logs on failure, e.g. `compose:logs`. */
  logsTask: string
}

/**
 * Waits until every matching container runs (and is healthy when it declares a
 * healthcheck), then checks again after a short delay to catch containers
 * crashing right after start. Fails fast on exited or unhealthy containers.
 */
export async function waitReady(options: WaitOptions): Promise<void> {
  const { host, facts, filterSets, timeoutSeconds, logger, verbose, logsTask } = options
  const deadline = Date.now() + timeoutSeconds * 1000
  let confirmed = false

  while (true) {
    const list = await listContainers(host, facts, filterSets)
    if (!list.length) throw new Error(`[${host.name}] no container found`)

    const failed = list.filter((c) => containerState(c.state, c.status) === 'failed')
    if (failed.length) {
      const details = failed.map((c) => `${c.name} (${c.status || c.state})`).join(', ')
      throw new Error(`[${host.name}] containers failed: ${details}. See \`cata task ${logsTask}\``)
    }

    const pending = list.filter((c) => containerState(c.state, c.status) === 'pending')
    if (!pending.length) {
      if (confirmed) {
        if (verbose >= Verbose.NORMAL) logger.step(host.name, `${list.length} container(s) ready`)
        return
      }
      confirmed = true
      await sleep(2_000)
      continue
    }

    confirmed = false
    if (Date.now() >= deadline) {
      const details = pending.map((c) => `${c.name} (${c.status || c.state})`).join(', ')
      throw new Error(`[${host.name}] containers not ready after ${timeoutSeconds}s: ${details}`)
    }
    await sleep(2_000)
  }
}
