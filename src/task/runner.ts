import type { Host, DeployContext, Paths } from '../types.ts'
import { Strategy } from '../enums.ts'
import { ssh } from '../utils.ts'
import { logger, type CatapultLogger } from '../logger.ts'

export interface TaskContext {
  host: Host
  paths: Paths
  deployCtx: DeployContext
  logger: CatapultLogger
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

  isVerbose(): 0 | 1 | 2 {
    return this.#ctx?.deployCtx.config.verbose ?? 0
  }

  resolve(str: string): string {
    if (!this.#ctx) return str
    const p = this.#ctx.paths
    const strategy = this.#ctx.deployCtx.config.strategy ?? Strategy.Direct
    const buildPath = strategy === Strategy.Build ? p.build : p.release
    return str
      .replace(/\{\{release_path\}\}/g, p.release)
      .replace(/\{\{build_path\}\}/g, buildPath)
      .replace(/\{\{current_path\}\}/g, p.current)
      .replace(/\{\{shared_path\}\}/g, p.shared)
      .replace(/\{\{releases_path\}\}/g, p.releases)
      .replace(/\{\{base_path\}\}/g, p.base)
      .replace(/\{\{release\}\}/g, this.#ctx.deployCtx.release)
  }

  async flush(): Promise<void> {
    if (!this.#ctx || this.#commands.length === 0) return
    const cmds = this.#commands.splice(0)
    const verbose = this.#ctx.deployCtx.config.verbose ?? 0
    if (verbose >= 1) {
      for (const cmd of cmds) logger.cmd(cmd)
    }
    const subprocess = ssh(this.#ctx.host, ['set -e', ...cmds].join('\n'), { color: true })
    if (verbose >= 2) subprocess.stdout?.pipe(process.stdout)
    await subprocess
  }
}
