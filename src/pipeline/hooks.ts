import type { Host, DeployContext } from '../types.ts'
import type { CatapultLogger } from '../logger.ts'

export type LifecycleHook = (
  ctx: DeployContext,
  host: Host,
  logger: CatapultLogger
) => Promise<void> | void

export class PipelineHookStore {
  #setupHooks: LifecycleHook[] = []
  #statusHooks: LifecycleHook[] = []

  addSetup(fn: LifecycleHook): void {
    this.#setupHooks.push(fn)
  }

  getSetup(): LifecycleHook[] {
    return [...this.#setupHooks]
  }

  addStatus(fn: LifecycleHook): void {
    this.#statusHooks.push(fn)
  }

  getStatus(): LifecycleHook[] {
    return [...this.#statusHooks]
  }
}

export const hooks = new PipelineHookStore()
