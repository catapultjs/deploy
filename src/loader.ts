import type { ResolveHook } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'url'
import { resolve as resolvePath, dirname } from 'path'
import { existsSync } from 'fs'

// loader is at build/src/loader.js → packageRoot = build/
const packageRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

export const resolve: ResolveHook = (specifier, context, nextResolve) => {
  if (specifier === '@jrmc/catapult') {
    return nextResolve(pathToFileURL(resolvePath(packageRoot, 'index.js')).href, context)
  }

  if (specifier.startsWith('@jrmc/catapult/')) {
    const sub = specifier.slice('@jrmc/catapult/'.length)
    const candidate = resolvePath(packageRoot, sub + '.js')
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context)
    }
  }

  return nextResolve(specifier, context)
}
