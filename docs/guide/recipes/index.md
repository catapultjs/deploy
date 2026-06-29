---
description: Drop-in Catapult recipes for Astro, AdonisJS, Caddy, Directus, NestJS, Next.js, Nuxt, PM2, Redis, systemd, TanStack, VitePress, git and rsync.
---

# Recipes

Recipes are importable modules that register tasks and insert them into the pipeline automatically.

| Recipe                         | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| [astro](./astro)               | Astro remote build for server output                     |
| [astro_static](./astro_static) | Astro static site with local build                       |
| [caddy](./caddy)               | Validate, reload, and upload Caddy configuration         |
| [git](./git)                   | Clone the repository and log revisions                   |
| [rsync](./rsync)               | Transfer files via rsync                                 |
| [adonisjs](./adonisjs)         | AdonisJS-specific deployment steps with remote build     |
| [adonisjs_local](./adonisjs_local) | AdonisJS local build plus artifact upload            |
| [directus](./directus)         | Directus schema and database tasks                       |
| [nestjs](./nestjs)             | NestJS remote build using standard Node.js tasks         |
| [nextjs](./nextjs)             | Next.js remote build with standalone output symlinks     |
| [nextjs_static](./nextjs_static) | Next.js static export with local build                 |
| [nuxt](./nuxt)                 | Nuxt build and static generation tasks                   |
| [nuxt_static](./nuxt_static)   | Nuxt static site with local generation                   |
| [pm2](./pm2)                   | Process management with PM2                              |
| [redis](./redis)               | Flush one, many, or all Redis databases                  |
| [systemd](./systemd)           | Restart, reload, inspect, and read logs for services     |
| [tanstack](./tanstack)         | TanStack Start remote build for Node.js server output    |
| [vitepress](./vitepress)       | Build VitePress locally and upload static artifacts      |
