---
description: Drop-in Catapult recipes for Astro, AdonisJS, Caddy, Docker and Podman (Compose or plain containers), Directus, NestJS, Next.js, Nuxt, PM2, Redis, systemd, TanStack, VitePress, git and rsync.
---

# Recipes

Recipes are importable modules that register tasks. Application recipes usually insert deployment steps; service recipes such as systemd and Caddy require explicit pipeline placement.

| Recipe                         | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| [astro](./astro)               | Astro remote build for server output                     |
| [astro_static](./astro_static) | Astro static site with local build                       |
| [caddy](./caddy)               | Validate, reload, and upload Caddy configuration         |
| [compose](./compose)           | Compose stack with Docker or Podman, image over SSH      |
| [container](./container)       | Containers from one image with Docker or Podman, no Compose |
| [git](./git)                   | Clone the repository and log revisions                   |
| [rsync](./rsync)               | Transfer files via rsync                                 |
| [adonisjs](./adonisjs)         | AdonisJS-specific deployment steps with remote build     |
| [adonisjs_local](./adonisjs_local) | AdonisJS local build plus artifact upload            |
| [directus](./directus)         | Directus schema and database tasks                       |
| [nestjs](./nestjs)             | NestJS remote build using standard Node.js tasks         |
| [nextjs](./nextjs)             | Next.js remote build with standalone output symlinks     |
| [nextjs_local](./nextjs_local) | Next.js standalone server built locally and uploaded |
| [nextjs_static](./nextjs_static) | Next.js static export with local build                 |
| [nuxt](./nuxt)                 | Nuxt build and static generation tasks                   |
| [nuxt_static](./nuxt_static)   | Nuxt static site with local generation                   |
| [pm2](./pm2)                   | Process management with PM2                              |
| [redis](./redis)               | Flush one, many, or all Redis databases                  |
| [systemd](./systemd)           | Restart, reload, inspect, and read logs for services     |
| [tanstack](./tanstack)         | TanStack Start remote build for Node.js server output    |
| [vitepress](./vitepress)       | Build VitePress locally and upload static artifacts      |

## Choosing a deployment approach

| Application / recipe | Build location | File transfer | Runtime |
| --- | --- | --- | --- |
| `adonisjs`, `astro`, `nestjs`, `nextjs`, `nuxt`, `tanstack` | Server | Core SCP by default; Git or rsync can replace it | Node.js with PM2, systemd, or your own process manager |
| `adonisjs_local` | Local; production dependencies installed on server | Recipe uploads build output with SCP | Node.js with a process manager |
| `nextjs_local` | Local | Recipe uploads standalone output with SCP; optional archive | Node.js with a process manager |
| `astro_static`, `nextjs_static`, `nuxt_static` | Local | Core SCP uploads the generated static directory | Static web server |
| `vitepress` | Local | Recipe uploads generated documentation with SCP | Static web server |
| `compose` | Local image build | Recipe streams the image over SSH, no registry | Docker or Podman with Compose |
| `container` | Local image build | Recipe streams the image over SSH, no registry | Docker or Podman containers |

Choose one provider of `deploy:update_code`. Do not combine Git or rsync with a recipe that already owns artifact delivery unless you deliberately replace its pipeline. A Git transfer deploys repository content, not your locally generated output.

Application build recipes do not automatically choose a process manager. Import `pm2` for its deployment reload steps, or explicitly place `systemd:restart` after `deploy:publish`. Caddy can serve static output or proxy to the application's port; its upload/reload tasks also need explicit placement.

For first-time systemd installation, follow the [bootstrap example](./systemd#first-installation). For complete configurations, see [Deployment Examples](/guide/deployment-examples).
