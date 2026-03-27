# Getting Started

## Installation

```bash
npm install @jrmc/catapult
```

Once installed, the `ctp` CLI is available:

```bash
ctp deploy
```

## Usage

Create a `deploy.ts` file at the root of your project:

```typescript
import { defineConfig } from '@jrmc/catapult'
import '@jrmc/catapult/recipes/adonisjs'
import '@jrmc/catapult/recipes/pm2'

await defineConfig({
  keepReleases: 5,

  repository: 'git@github.com:user/myapp.git', // optional, auto-detected from origin
  healthcheckRetries: 10,
  healthcheckDelayMs: 3000,

  hosts: [
    {
      name: 'staging',
      ssh: 'deploy@staging.example.com',
      deployPath: '/home/deploy/staging/myapp',
      branch: 'develop',
      healthcheckUrl: 'http://127.0.0.1:3333/health',
    },
    {
      name: 'production',
      ssh: 'deploy@prod.example.com',
      deployPath: '/home/deploy/prod/myapp',
      branch: 'main',
      healthcheckUrl: 'http://127.0.0.1:3333/health',
    },
  ],

  verbose: true, // prints SSH commands in the terminal (default: true)
})
```

## Commands

```bash
# Deploy
ctp deploy

# Initial server setup (create directories)
ctp deploy:setup

# Rollback to the previous release
ctp rollback

# Server status
ctp status

# List releases
ctp list:releases

# List registered tasks and the current pipeline
ctp list:tasks

# Run a specific task on servers
ctp task <task-name>

# Target a specific host
ctp deploy --host staging
```

## Server structure

After `ctp deploy:setup`, the server will have the following structure:

```
/base/
  current/          → symlink to releases/<release>
  releases/
    2024-01-15T.../ ← active release
    2024-01-14T.../
  shared/
    .env            (AdonisJS recipe)
    storage/        (AdonisJS recipe)
    logs/           (AdonisJS recipe)
    tmp/            (AdonisJS recipe)
  revisions.log
  deploy.lock       ← present during a deployment
```

## Multi-server

```typescript
hosts: [
  {
    name: 'staging',
    ssh: 'deploy@staging.example.com',
    deployPath: '/home/deploy/staging/myapp',
    branch: 'develop',
    healthcheckUrl: 'http://127.0.0.1:3333/health',
  },
  {
    name: 'production',
    ssh: 'deploy@prod.example.com',
    deployPath: '/home/deploy/prod/myapp',
    branch: 'main',
    healthcheckUrl: 'http://127.0.0.1:3333/health',
  },
],
```

Deployment runs sequentially on each host. To target a single host:

```bash
ctp deploy --host staging
```

## Automatic rollback

If a failure occurs after `deploy:publish`, an automatic rollback is triggered:
the previous release is restored and PM2 is reloaded if present in the pipeline.
