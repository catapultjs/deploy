import type { Config } from './types.ts'
import { Context } from './context.ts'

export async function defineConfig(config: Config): Promise<void> {
  const release = new Date().toISOString().replace(/[:.]/g, '-')
  Context.set({ config, release, hooks: config.hooks ?? {} })
}
