import type { Host, Config, Paths } from '../types.ts'
import { Strategy, Verbose } from '../enums.ts'
import { ssh } from '../utils.ts'
import { logger, type CatapultLogger } from '../logger.ts'

export interface TaskContext {
  readonly host: Host
  readonly paths: Paths
  readonly config: Config
  readonly logger: CatapultLogger
  readonly release: string
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

  isVerbose(level: Verbose): boolean {
    return (this.#ctx?.config.verbose ?? 0) >= level
  }

  resolve(str: string): string {
    if (!this.#ctx) return str
    const p = this.#ctx.paths
    const strategy = this.#ctx.config.strategy ?? Strategy.DIRECT
    const buildPath = strategy === Strategy.BUILD ? p.builder : p.release
    return str
      .replace(/\{\{release_path\}\}/g, p.release)
      .replace(/\{\{builder_path\}\}/g, buildPath)
      .replace(/\{\{current_path\}\}/g, p.current)
      .replace(/\{\{shared_path\}\}/g, p.shared)
      .replace(/\{\{releases_path\}\}/g, p.releases)
      .replace(/\{\{base_path\}\}/g, p.base)
      .replace(/\{\{release\}\}/g, this.#ctx.release)
  }

  async flush(): Promise<void> {
    if (!this.#ctx || this.#commands.length === 0) return
    const cmds = this.#commands.splice(0)
    const verbose = this.#ctx.config.verbose ?? Verbose.SILENT
    if (verbose >= Verbose.TRACE) {
      for (const cmd of cmds) logger.cmd(cmd)
    }
    const subprocess = ssh(this.#ctx.host, ['set -e', ...cmds].join('\n'), { color: true })
    if (verbose >= Verbose.DEBUG) subprocess.stdout?.pipe(process.stdout)
    await subprocess
  }
}
