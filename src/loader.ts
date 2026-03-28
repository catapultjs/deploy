import type { ResolveHook } from 'node:module'
import { fileURLToPath } from 'url'
import { resolve as resolvePath, dirname } from 'path'
import { existsSync } from 'fs'

const packageRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

export const resolve: ResolveHook = (specifier, context, nextResolve) => {
  if (specifier === '@jrmc/catapult') {
    return nextResolve(resolvePath(packageRoot, 'index.js'), context)
  }

  if (specifier.startsWith('@jrmc/catapult/')) {
    const sub = specifier.slice('@jrmc/catapult/'.length)
    const candidate = resolvePath(packageRoot, 'build', sub + '.js')
    if (existsSync(candidate)) {
      return nextResolve(candidate, context)
    }
  }

  return nextResolve(specifier, context)
}
