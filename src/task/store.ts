import type { Host, DeployContext, TaskName } from '../types.ts'
import { getPaths } from '../utils.ts'
import { type TaskFn, TaskRunner } from './runner.ts'

export class TaskStore {
  #registry = new Map<string, TaskFn>()
  #runner: TaskRunner

  constructor(runner: TaskRunner) {
    this.#runner = runner
  }

  register(name: TaskName, fn: TaskFn): void {
    this.#registry.set(name, fn)
  }

  has(name: TaskName): boolean {
    return this.#registry.has(name)
  }

  list(): string[] {
    return [...this.#registry.keys()]
  }

  async run(name: TaskName, deployCtx: DeployContext, host: Host): Promise<void> {
    const fn = this.#registry.get(name)
    if (!fn) throw new Error(`Task not found: "${name}"`)

    const paths = getPaths(host.deployPath, deployCtx.release)
    const ctx = { host, paths, deployCtx }
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
