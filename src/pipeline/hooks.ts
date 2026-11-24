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
  #beforeRollbackHooks: LifecycleHook[] = []
  #rollbackHooks: LifecycleHook[] = []

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

  addBeforeRollback(fn: LifecycleHook): void {
    this.#beforeRollbackHooks.push(fn)
  }

  getBeforeRollback(): LifecycleHook[] {
    return [...this.#beforeRollbackHooks]
  }

  addRollback(fn: LifecycleHook): void {
    this.#rollbackHooks.push(fn)
  }

  getRollback(): LifecycleHook[] {
    return [...this.#rollbackHooks]
  }
}

export const hooks = new PipelineHookStore()
