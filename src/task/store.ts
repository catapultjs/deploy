import type { Host, DeployContext, TaskName } from '../types.ts'
import { getPaths } from '../utils.ts'
import type { TaskFn, TaskRunner } from './runner.ts'
import { logger } from '../logger.ts'

export class TaskStore {
  #registry = new Map<string, TaskFn>()
  #descriptions = new Map<string, string>()
  #pendingDescription: string | null = null
  #runner: TaskRunner

  constructor(runner: TaskRunner) {
    this.#runner = runner
  }

  describe(description: string): void {
    this.#pendingDescription = description
  }

  register(name: TaskName, fn: TaskFn): void {
    this.#registry.set(name, fn)
    if (this.#pendingDescription !== null) {
      this.#descriptions.set(name, this.#pendingDescription)
      this.#pendingDescription = null
    }
  }

  has(name: TaskName): boolean {
    return this.#registry.has(name)
  }

  list(): string[] {
    return [...this.#registry.keys()]
  }

  getDescription(name: TaskName): string {
    return this.#descriptions.get(name) ?? ''
  }

  async run(name: TaskName, deployCtx: DeployContext, host: Host): Promise<void> {
    const fn = this.#registry.get(name)
    if (!fn) throw new Error(`Task not found: "${name}"`)

    const paths = getPaths(host.deployPath, deployCtx.release)
    const ctx = { host, paths, config: deployCtx.config, release: deployCtx.release, logger }
    this.#runner.set(ctx)

    try {
      const result = fn(ctx)
      if (result instanceof Promise) await result
      await this.#runner.flush()
    } finally {
      this.#runner.clear()
    }
  }
}
