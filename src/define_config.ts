import type { Config } from './types.ts'
import { Verbose } from './enums.ts'
import { Context } from './context.ts'
import { detectPackageManager } from './utils.ts'
import { remove, getPipeline } from './pipeline.ts'

const initialConfigValues = {
  keepReleases: 5,
  verbose: Verbose.TRACE,
}

export function defineConfig(config: Config): () => Promise<void> {
  const resolved: Config = { ...initialConfigValues, ...config }

  return async () => {
    const pm = await detectPackageManager()
    const release = new Date().toISOString().replace(/[:.]/g, '-')
    Context.set({
      config: { packageManager: pm, ...resolved },
      release,
      hooks: config.hooks ?? {},
    })

    const hasHealthcheck = config.hosts.some((h) => h.healthcheck?.url)
    if (!hasHealthcheck && getPipeline().includes('deploy:healthcheck')) {
      remove('deploy:healthcheck')
    }
  }
}
