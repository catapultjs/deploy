---
title: Deploying Next.js standalone output over SSH
date: 2026-06-20
author: Jérémy Chaufourier
description: Deploy a Next.js standalone build to a VPS with Catapult, PM2, shared environment files and release-based rollback.
---

# Deploying Next.js standalone output over SSH

Next.js has a production mode that fits SSH deployments well: `output: 'standalone'`. The build produces a compact server bundle at `.next/standalone/server.js`, which can be started with Node or PM2 without shipping the full development tree.

There is one detail that matters: standalone output does not automatically include `public` or `.next/static`. Catapult's `nextjs` recipe builds on the server, then links both directories into the standalone output so the deployed server can serve static assets correctly.

## The target layout

After a successful deploy, the active release should look conceptually like this:

```txt
/home/deploy/myapp/current
├── .env -> /home/deploy/myapp/shared/.env
├── .next/
│   ├── standalone/
│   │   ├── server.js
│   │   ├── public -> /home/deploy/myapp/current/public
│   │   └── .next/static -> /home/deploy/myapp/current/.next/static
│   └── static/
├── ecosystem.config.cjs
└── public/
```

`current` is a symlink managed by Catapult. PM2 points at `current`, while Catapult creates immutable releases under `releases/<timestamp>`.

## Next.js config

Enable standalone output in `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

The upstream behavior is documented in the [Next.js output documentation](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output).

## Catapult config

Install Catapult:

```bash
npm install --save-dev @catapultjs/deploy
```

Then create `deploy.ts`:

```typescript
import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nextjs'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@your-server.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})
```

This gives you the deployment chain:

```txt
git checkout release -> npm install -> next build -> standalone symlinks -> publish current -> PM2 reload
```

For a monorepo, configure the app path before importing the recipe:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'

set('nextjs_path', 'apps/web')

import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nextjs'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({ ... })
```

## Environment file

Run setup once:

```bash
npx cata deploy:setup
```

Then upload the production `.env` to the shared directory:

```bash
scp .env deploy@your-server.com:/home/deploy/myapp/shared/.env
```

The `nextjs` recipe declares `.env` as a shared file. Each new release receives a symlink to the same server-side environment file.

## PM2 entrypoint

Commit an `ecosystem.config.cjs` to your project:

```javascript
const path = require('path')
const deployPath = '/home/deploy/myapp'

module.exports = {
  apps: [
    {
      name: 'next',
      cwd: path.join(deployPath, 'current'),
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'cluster',
    },
  ],
}
```

The `cwd` is the important part. The standalone server should run from the active release so relative paths resolve to that release's `.next` and `public` directories.

## Deploy and inspect

Deploy:

```bash
npx cata deploy
```

Inspect PM2:

```bash
npx cata task pm2:list
npx cata task pm2:logs
```

Check the app locally from the server if needed:

```bash
curl -I http://127.0.0.1:3000
```

If that works but the site is not reachable from the internet, the issue is usually the reverse proxy or firewall. Point Nginx, Caddy, Traefik or your load balancer to `127.0.0.1:3000`.

## Rollback behavior

Because every deploy creates a new release, rollback is just a symlink switch:

```bash
npx cata rollback
```

If PM2 is part of the pipeline, Catapult reloads it after the rollback target becomes `current` again.

## Static export?

This article covers a server-rendered standalone Next.js deployment. If your project uses `output: 'export'`, use [`recipes/nextjs_static`](/guide/recipes/nextjs_static) instead. That recipe builds locally and deploys `./out/.` as static files.
