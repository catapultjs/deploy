import type { Host, DeployContext, Paths } from '../types.ts'
import { ssh, yellow } from '../utils.ts'

export interface TaskContext {
  host: Host
  paths: Paths
  deployCtx: DeployContext
}

export type TaskFn = (ctx: TaskContext) => void | Promise<void>

export class TaskRunner {
  #ctx: TaskContext | null = null
  #commands: string[] = []

  get(): TaskContext | null {
    return this.#ctx
  }

  set(ctx: TaskContext): void {
    this.#ctx = ctx
    this.#commands = []
  }

  clear(): void {
    this.#ctx = null
    this.#commands = []
  }

  push(command: string): void {
    if (!this.#ctx) throw new Error('cd() or run() must be called inside a task')
    this.#commands.push(command)
  }

  bin(name: string): string {
    return this.#ctx?.host.bin?.[name] ?? name
  }

  isVerbose(): boolean {
    return this.#ctx?.deployCtx.config.verbose ?? false
  }

  resolve(str: string): string {
    if (!this.#ctx) return str
    const p = this.#ctx.paths
    return str
      .replace(/\{\{release_path\}\}/g, p.release)
      .replace(/\{\{current_path\}\}/g, p.current)
      .replace(/\{\{shared_path\}\}/g, p.shared)
      .replace(/\{\{releases_path\}\}/g, p.releases)
      .replace(/\{\{base_path\}\}/g, p.base)
      .replace(/\{\{release\}\}/g, this.#ctx.deployCtx.release)
  }

  async flush(): Promise<void> {
    if (!this.#ctx || this.#commands.length === 0) return
    const cmds = this.#commands.splice(0)
    if (this.#ctx.deployCtx.config.verbose) {
      for (const cmd of cmds) console.log(yellow(`    $ ${cmd}`))
    }
    await ssh(this.#ctx.host, ['set -e', ...cmds].join('\n'))
  }
}
