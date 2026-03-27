import type { DeployContext } from './types.ts'

let _ctx: DeployContext | null = null

export function setCtx(ctx: DeployContext): void {
  _ctx = ctx
}

export function getCtx(): DeployContext {
  if (!_ctx) throw new Error('No deploy context. Call defineConfig() first.')
  return _ctx
}
