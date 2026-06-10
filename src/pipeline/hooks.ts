import type { Host, DeployContext } from '../types.ts'
import type { CatapultLogger } from '../logger.ts'

export type LifecycleHook = (
  ctx: DeployContext,
  host: Host,
  logger: CatapultLogger
) => Promise<void> | void

export type StatusData = Record<string, unknown>

export type StatusHook = (
  ctx: DeployContext,
  host: Host,
  logger: CatapultLogger
) => Promise<StatusData | void> | StatusData | void

export class PipelineHookStore {
  #setupHooks: LifecycleHook[] = []
  #statusHooks: StatusHook[] = []

  addSetup(fn: LifecycleHook): void {
    this.#setupHooks.push(fn)
  }

  getSetup(): LifecycleHook[] {
    return [...this.#setupHooks]
  }

  addStatus(fn: StatusHook): void {
    this.#statusHooks.push(fn)
  }

  getStatus(): StatusHook[] {
    return [...this.#statusHooks]
  }
}

export const hooks = new PipelineHookStore()
