import type { Config } from './types.ts'
import { Strategy } from './enums.ts'
import { Context } from './context.ts'
import { detectPackageManager } from './utils.ts'
import { remove, getPipeline } from './pipeline.ts'
import './defaults.ts'

const initialConfigValues = {
  keepReleases: 5,
  verbose: 1 as const,
  strategy: Strategy.Direct,
}

export function defineConfig(config: Config): () => Promise<void> {
  return async () => {
    const pm = await detectPackageManager()
    const release = new Date().toISOString().replace(/[:.]/g, '-')
    const initial = { packageManager: pm, ...initialConfigValues }
    Context.set({
      config: { ...initial, ...config },
      release,
      hooks: config.hooks ?? {},
    })

    const hasHealthcheck = config.hosts.some((h) => h.healthcheck?.url)
    if (!hasHealthcheck && getPipeline().includes('deploy:healthcheck')) {
      remove('deploy:healthcheck')
    }

    const strategy = config.strategy ?? Strategy.Direct
    if (strategy !== Strategy.Build) {
      remove('deploy:build:copy')
      remove('deploy:build:shared')
    }
  }
}
