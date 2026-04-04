import { bin } from './task.ts'
import { get } from './store.ts'

/** Returns the current package manager binary (npm, pnpm, yarn). */
export function pm(): string {
  return bin(get('package_manager', 'npm'))
}

/** Returns the install command with frozen lockfile. */
export function pmInstall(): string {
  const manager: string = get('package_manager', 'npm')
  if (manager === 'pnpm') return `${pm()} install --frozen-lockfile`
  if (manager === 'yarn') return `${pm()} install --frozen-lockfile`
  return `${pm()} ci`
}

/** Returns the production-only install command. */
export function pmInstallProd(): string {
  const manager: string = get('package_manager', 'npm')
  if (manager === 'pnpm') return `${pm()} install --prod`
  if (manager === 'yarn') return `${pm()} install --production`
  return `${pm()} install --omit=dev`
}
