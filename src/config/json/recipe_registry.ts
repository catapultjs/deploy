export const BUILT_IN_RECIPE_NAMES = [
  'adonisjs',
  'adonisjs_local',
  'astro',
  'astro_static',
  'caddy',
  'directus',
  'git',
  'nestjs',
  'nextjs',
  'nextjs_static',
  'nuxt',
  'nuxt_static',
  'pm2',
  'redis',
  'rsync',
  'systemd',
  'tanstack',
  'vitepress',
] as const

export type BuiltInRecipeName = (typeof BUILT_IN_RECIPE_NAMES)[number]

const recipeLoaders: Record<BuiltInRecipeName, () => Promise<unknown>> = {
  adonisjs: () => import('../../../recipes/adonisjs.ts'),
  adonisjs_local: () => import('../../../recipes/adonisjs_local.ts'),
  astro: () => import('../../../recipes/astro.ts'),
  astro_static: () => import('../../../recipes/astro_static.ts'),
  caddy: () => import('../../../recipes/caddy.ts'),
  directus: () => import('../../../recipes/directus.ts'),
  git: () => import('../../../recipes/git.ts'),
  nestjs: () => import('../../../recipes/nestjs.ts'),
  nextjs: () => import('../../../recipes/nextjs.ts'),
  nextjs_static: () => import('../../../recipes/nextjs_static.ts'),
  nuxt: () => import('../../../recipes/nuxt.ts'),
  nuxt_static: () => import('../../../recipes/nuxt_static.ts'),
  pm2: () => import('../../../recipes/pm2.ts'),
  redis: () => import('../../../recipes/redis.ts'),
  rsync: () => import('../../../recipes/rsync.ts'),
  systemd: () => import('../../../recipes/systemd.ts'),
  tanstack: () => import('../../../recipes/tanstack.ts'),
  vitepress: () => import('../../../recipes/vitepress.ts'),
}

export async function loadBuiltInRecipe(name: BuiltInRecipeName): Promise<void> {
  await recipeLoaders[name]()
}
