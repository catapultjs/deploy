import type { Config } from './types.ts'
import { setCtx } from './ctx.ts'

export async function defineConfig(config: Config): Promise<void> {
  const release = new Date().toISOString().replace(/[:.]/g, '-')
  setCtx({ config, release, hooks: config.hooks ?? {} })
}
