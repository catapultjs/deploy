## description: Drop-in Catapult recipes for Astro, AdonisJS, Directus, Nuxt, PM2, Redis, VitePress, git and rsync.

# Recipes

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

Recipes are importable modules that register tasks and insert them into the pipeline automatically.

| Recipe                   | Description                                         |
| ------------------------ | --------------------------------------------------- |
| [astro](./astro)         | Build locally with Astro and upload artifacts       |
| [git](./git)             | Clone the repository and log revisions              |
| [rsync](./rsync)         | Transfer files via rsync                            |
| [adonisjs](./adonisjs)   | AdonisJS-specific deployment steps                  |
| [directus](./directus)   | Directus schema and database tasks                  |
| [nuxt](./nuxt)           | Nuxt build and static generation tasks              |
| [pm2](./pm2)             | Process management with PM2                         |
| [redis](./redis)         | Flush one, many, or all Redis databases             |
| [vitepress](./vitepress) | Build VitePress locally and upload static artifacts |
