export const Strategy = {
  Build: 'build',
  Direct: 'direct',
} as const
export type Strategy = (typeof Strategy)[keyof typeof Strategy]

export const PackageManager = {
  Npm: 'npm',
  Pnpm: 'pnpm',
  Yarn: 'yarn',
  Bun: 'bun',
} as const
export type PackageManager = (typeof PackageManager)[keyof typeof PackageManager]
