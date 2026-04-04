import type { DeployContext } from './types.ts'

export class Context {
  static #instance: DeployContext | null = null

  static set(ctx: DeployContext): void {
    Context.#instance = ctx
  }

  static get(): DeployContext {
    if (!Context.#instance) throw new Error('No deploy context. Call defineConfig() first.')
    return Context.#instance
  }
}
