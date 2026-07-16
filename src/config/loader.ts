import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadJsonConfig } from './json/loader.ts'

export type DeployInitializer = () => Promise<void>

export async function loadDeployConfig(filePath: string): Promise<DeployInitializer> {
  if (extname(filePath).toLowerCase() === '.json') return loadJsonConfig(filePath)

  const module = await import(pathToFileURL(filePath).href)
  if (typeof module.default !== 'function') {
    throw new Error(`Deploy config "${filePath}" must default-export defineConfig(...)`)
  }

  return module.default as DeployInitializer
}
