import type { Config } from './types.ts'
import { Context } from './context.ts'
import { remove, getPipeline } from './pipeline.ts'
import './defaults.ts'

const initialConfigValues = {
  keepReleases: 5,
  packageManager: 'npm' as const,
}

export function defineConfig(config: Config): () => Promise<void> {
  return async () => {
    const release = new Date().toISOString().replace(/[:.]/g, '-')
    Context.set({
      config: { ...initialConfigValues, ...config },
      release,
      hooks: config.hooks ?? {},
    })

    const hasHealthcheck = config.hosts.some((h) => h.healthcheck?.url)
    if (!hasHealthcheck && getPipeline().includes('deploy:healthcheck')) {
      remove('deploy:healthcheck')
    }
  }
}
