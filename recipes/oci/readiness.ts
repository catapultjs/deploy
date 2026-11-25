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

/** Restart count and start time of each container: they change when it restarts. */
async function restartMarks(host: Host, facts: RemoteFacts, names: string[]) {
  const { stdout } = await ssh(
    host,
    `set -e\n${q(facts.bin)} container inspect --format '{{.RestartCount}} {{.State.StartedAt}}' ${names.map(q).join(' ')}`
  )
  const lines = stdout.split('\n').filter(Boolean)
  return new Map(names.map((name, index) => [name, lines[index] ?? '']))
}

const SETTLE_MS = 3_000
/** Restarts tolerated while waiting, e.g. a service retrying until its database is up. */
const CRASH_RESTARTS = 2

function restartCount(mark: string | undefined): number {
  return Number.parseInt(mark ?? '', 10) || 0
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
 * healthcheck), then checks again after a short delay. A container restarted in
 * between, or restarted repeatedly while waiting, is in a crash loop: with a
 * restart policy it shows as running (Podman) or alternates between restarting
 * and running (Docker backoff). Fails fast on exited or unhealthy containers.
 */
export async function waitReady(options: WaitOptions): Promise<void> {
  const { host, facts, filterSets, timeoutSeconds, logger, verbose, logsTask } = options
  const deadline = Date.now() + timeoutSeconds * 1000
  const crashLoop = (names: string[]) =>
    new Error(
      `[${host.name}] containers restarted while starting (crash loop): ${names.join(', ')}. See \`cata task ${logsTask}\``
    )
  const firstCounts = new Map<string, number>()
  let settled: Map<string, string> | null = null

  while (true) {
    const list = await listContainers(host, facts, filterSets)
    if (!list.length) throw new Error(`[${host.name}] no container found`)

    const failed = list.filter((c) => containerState(c.state, c.status) === 'failed')
    if (failed.length) {
      const details = failed.map((c) => `${c.name} (${c.status || c.state})`).join(', ')
      throw new Error(`[${host.name}] containers failed: ${details}. See \`cata task ${logsTask}\``)
    }

    const marks = await restartMarks(
      host,
      facts,
      list.map((c) => c.name)
    )
    const looping = list.filter((c) => {
      const count = restartCount(marks.get(c.name))
      if (!firstCounts.has(c.name)) firstCounts.set(c.name, count)
      return count - (firstCounts.get(c.name) ?? count) >= CRASH_RESTARTS
    })
    if (looping.length) throw crashLoop(looping.map((c) => c.name))

    const pending = list.filter((c) => containerState(c.state, c.status) === 'pending')
    if (!pending.length) {
      const previous = settled
      if (previous && list.every((c) => previous.has(c.name))) {
        const restarted = list.filter((c) => previous.get(c.name) !== marks.get(c.name))
        if (restarted.length) throw crashLoop(restarted.map((c) => c.name))
        if (verbose >= Verbose.NORMAL) logger.step(host.name, `${list.length} container(s) ready`)
        return
      }
      settled = marks
      await sleep(SETTLE_MS)
      continue
    }

    settled = null
    if (Date.now() >= deadline) {
      const details = pending.map((c) => `${c.name} (${c.status || c.state})`).join(', ')
      throw new Error(`[${host.name}] containers not ready after ${timeoutSeconds}s: ${details}`)
    }
    await sleep(2_000)
  }
}
