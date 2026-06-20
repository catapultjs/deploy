---
title: Deploying an AdonisJS application with PM2 and Catapult
date: 2026-06-15
author: Jérémy Chaufourier
description: A step-by-step walkthrough for deploying an AdonisJS application to a VPS using Catapult, the git recipe and PM2 for process management.
---

# Deploying an AdonisJS application with PM2 and CatapultJS

This guide walks through a production-ready deployment setup for an AdonisJS application: versioned releases on a VPS, PM2 for process management, and automatic rollback on failure.

## Prerequisites

- A VPS with SSH key access and Node.js installed
- An AdonisJS application in a Git repository
- Catapult installed as a dev dependency

```bash
npm install --save-dev @catapultjs/deploy
```

## Configuration

Create a `deploy.ts` at the root of your project:

```typescript
import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({
  repository: 'git@github.com:you/myapp.git',
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@your-server.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})
```

The three recipes wire automatically into the pipeline:

- `recipes/git` — clones the repository into each release via a bare mirror cached on the server
- `recipes/adonisjs` — installs dependencies, builds assets and runs migrations
- `recipes/pm2` — reloads PM2 after the release is published

## Server setup

Run setup once per host to create the directory structure:

```bash
npx cata deploy:setup
```

This creates `releases/`, `shared/` and `.catapult/` under `deployPath`. Add your `.env` to `shared/`:

```bash
scp .env deploy@your-server.com:/home/deploy/myapp/shared/.env
```

The `adonisjs` recipe already declares `.env` and `storage/` as shared paths. If you need to add more, use `set()` before the recipe import:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'

set('shared_dirs', ['storage', 'logs', 'tmp/uploads'])
set('shared_files', ['.env'])

import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({ ... })
```

## First deployment

```bash
npx cata deploy
```

Catapult runs the full pipeline, verifies the healthcheck URL, and activates the new release atomically. If the healthcheck fails, it rolls back automatically.

## PM2 ecosystem file

The `pm2` recipe expects an `ecosystem.config.cjs` at the root of each release. A minimal example:

```javascript
const path = require("path");
const root = path.resolve(__dirname, "../../", "current");

module.exports = {
  apps: [
    {
      name: 'myapp',
      script: path.join(root, 'build/bin/server.js'),
      instances: 'max',
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
    },
  ],
}
```

Commit it to your repository — it will be deployed with every release.

## Rolling back

If something goes wrong after a deploy, roll back to the previous release in one command:

```bash
npx cata rollback
```

Or pick a specific release interactively:

```bash
npx cata rollback --interactive
```

## What's next

- Add a [GitHub Actions workflow](/guide/ci-cd) to trigger deploys on push to `main`
- Use `cata status` to inspect the active release and PM2 version across hosts
- Explore the `adonisjs_local` recipe if you prefer building the app locally before uploading
