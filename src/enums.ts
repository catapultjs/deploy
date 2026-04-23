export const Strategy = {
  BUILD: 'build',
  DIRECT: 'direct',
} as const
export type Strategy = (typeof Strategy)[keyof typeof Strategy]

export const PackageManager = {
  NPM: 'npm',
  PNPM: 'pnpm',
  YARN: 'yarn',
  BUN: 'bun',
} as const
export type PackageManager = (typeof PackageManager)[keyof typeof PackageManager]

export const Verbose = {
  SILENT: 0,
  NORMAL: 1,
  TRACE: 2,
  DEBUG: 3,
} as const
export type Verbose = (typeof Verbose)[keyof typeof Verbose]
