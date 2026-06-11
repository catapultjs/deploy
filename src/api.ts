import { EventEmitter } from 'node:events'
import { MemoryRenderer } from '@poppinss/cliui'
import type { Config, DeployContext, Host, TaskName } from './types.ts'
import { Context } from './context.ts'
import { defineConfig } from './define_config.ts'
import { hasTask, getTasks, getTaskDescription, runTask } from './task.ts'
import { getPipeline } from './pipeline.ts'
import {
  deployHost,
  rollbackHost,
  initializeHost,
  isHostSetup,
  getCurrentRelease,
  getReleaseNames,
  getRevisions,
  type DeployObserver,
} from './deployer.ts'
import { collectHostStatus, type HostStatus } from './status.ts'
import { CatapultLogger } from './logger.ts'

export interface HostSelector {
  /** Host names to target. Defaults to all configured hosts. */
  hosts?: string[]
}

export interface RollbackOptions extends HostSelector {
  /** Release name to roll back to. Defaults to the previous release. */
  release?: string
}

export interface TaskEvent {
  host: string
  task: string
}

export interface TaskErrorEvent extends TaskEvent {
  error: Error
}

export interface HostDoneEvent {
  host: string
  release: string
}

export interface HostReleases {
  name: string
  current: string | null
  releases: string[]
}

export interface HostRevisions {
  name: string
  revisions: Record<string, unknown>[]
}

export interface TaskInfo {
  name: string
  description: string
}

export interface TaskOutput {
  host: string
  /** Everything the task wrote through its `logger`, joined with newlines. */
  output: string
}

export interface TaskList {
  pipeline: TaskInfo[]
  extra: TaskInfo[]
}

/**
 * Programmatic interface to Catapult. Wraps the same primitives as the CLI:
 *
 * ```typescript
 * import { Catapult } from '@catapultjs/deploy/api'
 * import '@catapultjs/deploy/recipes/git'
 *
 * const catapult = new Catapult({ hosts: [...] })
 * await catapult.setup()
 * await catapult.deploy()
 * const report = await catapult.status()
 * ```
 *
 * The deploy context is global — use a single instance per process.
 */
export class Catapult extends EventEmitter {
  #initialize: () => Promise<void>

  constructor(config: Config) {
    super()
    this.#initialize = defineConfig(config)
  }

  on(event: 'task:start', listener: (event: TaskEvent) => void): this
  on(event: 'task:done', listener: (event: TaskEvent) => void): this
  on(event: 'task:error', listener: (event: TaskErrorEvent) => void): this
  on(event: 'host:done', listener: (event: HostDoneEvent) => void): this
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  /** Re-runs the initializer so every operation gets a fresh release name. */
  async #context(): Promise<DeployContext> {
    await this.#initialize()
    return Context.get()
  }

  #resolveHosts(ctx: DeployContext, names?: string[]): Host[] {
    if (!names || names.length === 0) return ctx.config.hosts

    return names.map((name) => {
      const host = ctx.config.hosts.find((h) => h.name === name)
      if (!host) throw new Error(`Unknown host: ${name}`)
      return host
    })
  }

  /** Prepares the remote directory structure. Run once per host. */
  async setup(options: HostSelector = {}): Promise<void> {
    const ctx = await this.#context()
    for (const host of this.#resolveHosts(ctx, options.hosts)) {
      await initializeHost(ctx, host)
    }
  }

  /**
   * Deploys a new release to the selected hosts, running the full task
   * pipeline. Emits `task:start`, `task:done`, `task:error` and `host:done`.
   * Throws on the first failing host, after its auto-rollback.
   */
  async deploy(options: HostSelector = {}): Promise<void> {
    const ctx = await this.#context()
    const hosts = this.#resolveHosts(ctx, options.hosts)

    const observer: DeployObserver = {
      taskStart: (host, task) => this.emit('task:start', { host: host.name, task }),
      taskDone: (host, task) => this.emit('task:done', { host: host.name, task }),
      taskError: (host, task, error) => this.emit('task:error', { host: host.name, task, error }),
    }

    if (ctx.hooks.beforeDeploy) await ctx.hooks.beforeDeploy({ hosts })

    try {
      for (const host of hosts) {
        if (!(await isHostSetup(ctx, host))) {
          throw new Error(
            `[${host.name}] Catapult is not initialized on this server. Run setup() first.`
          )
        }

        await deployHost(ctx, host, observer)
        this.emit('host:done', { host: host.name, release: ctx.release })
      }
    } catch (error) {
      if (ctx.hooks.afterFailure) {
        await ctx.hooks.afterFailure({ hosts, error: error as Error })
      }
      throw error
    }

    if (ctx.hooks.afterDeploy) await ctx.hooks.afterDeploy({ hosts })
  }

  /**
   * Runs a single registered task on the selected hosts, against the
   * currently deployed release — like `cata task <name>`. Import the recipe
   * (or define the task) before calling.
   *
   * Returns what each task wrote through its `logger` — display tasks like
   * `pm2:logs` write their result there instead of printing it.
   */
  async task(name: TaskName, options: HostSelector = {}): Promise<TaskOutput[]> {
    const ctx = await this.#context()

    if (!hasTask(name)) {
      throw new Error(`Unknown task: ${name}. Available: ${getTasks().join(', ')}`)
    }

    const results: TaskOutput[] = []

    for (const host of this.#resolveHosts(ctx, options.hosts)) {
      if (!(await isHostSetup(ctx, host))) {
        throw new Error(
          `[${host.name}] Catapult is not initialized on this server. Run setup() first.`
        )
      }

      const currentRelease = await getCurrentRelease(ctx, host)
      if (!currentRelease) {
        throw new Error(`[${host.name}] no current release found, run deploy() first`)
      }

      const renderer = new MemoryRenderer()
      const taskLogger = new CatapultLogger()
      taskLogger.useRenderer(renderer)

      this.emit('task:start', { host: host.name, task: name })
      try {
        await runTask(name, { ...ctx, release: currentRelease }, host, { logger: taskLogger })
      } catch (error) {
        this.emit('task:error', { host: host.name, task: name, error })
        throw error
      }
      this.emit('task:done', { host: host.name, task: name })

      results.push({
        host: host.name,
        output: renderer
          .getLogs()
          .map((log) => log.message)
          .join('\n'),
      })
    }

    return results
  }

  /** Points `current` back to a previous release on the selected hosts. */
  async rollback(options: RollbackOptions = {}): Promise<void> {
    const ctx = await this.#context()
    for (const host of this.#resolveHosts(ctx, options.hosts)) {
      await rollbackHost(ctx, host, options.release)
    }
  }

  /**
   * Collects the status of the selected hosts — same data as
   * `cata status --json`. SSH failures are reported in the `error` field
   * of each entry instead of being thrown.
   */
  async status(options: HostSelector = {}): Promise<HostStatus[]> {
    const ctx = await this.#context()
    const hosts = this.#resolveHosts(ctx, options.hosts)

    const hookLogger = new CatapultLogger()
    hookLogger.useRenderer(new MemoryRenderer())

    const report: HostStatus[] = []
    for (const host of hosts) {
      report.push(await collectHostStatus(ctx, host, hookLogger))
    }
    return report
  }

  /**
   * Lists the releases present on the selected hosts, newest first — same
   * data as `cata list:releases --json`.
   */
  async listReleases(options: HostSelector = {}): Promise<HostReleases[]> {
    const ctx = await this.#context()

    const report: HostReleases[] = []
    for (const host of this.#resolveHosts(ctx, options.hosts)) {
      report.push({
        name: host.name,
        current: (await getCurrentRelease(ctx, host)) ?? null,
        releases: await getReleaseNames(ctx, host),
      })
    }
    return report
  }

  /**
   * Lists the last deployments recorded in `.catapult/revisions.log`,
   * newest first — same data as `cata list:revisions --json`.
   */
  async listRevisions(options: HostSelector & { limit?: number } = {}): Promise<HostRevisions[]> {
    const ctx = await this.#context()

    const report: HostRevisions[] = []
    for (const host of this.#resolveHosts(ctx, options.hosts)) {
      report.push({
        name: host.name,
        revisions: await getRevisions(ctx, host, options.limit),
      })
    }
    return report
  }

  /**
   * Lists the registered tasks, split between those in the pipeline and the
   * extra ones — same data as `cata list:tasks --json`.
   */
  async listTasks(): Promise<TaskList> {
    await this.#context()

    const pipeline = getPipeline()
    const describe = (name: string): TaskInfo => ({ name, description: getTaskDescription(name) })
    return {
      pipeline: pipeline.map(describe),
      extra: getTasks()
        .filter((t) => !pipeline.includes(t))
        .map(describe),
    }
  }

  /** Returns the current deployment pipeline — like `cata pipeline --json`. */
  async pipeline(): Promise<string[]> {
    await this.#context()
    return getPipeline()
  }
}
