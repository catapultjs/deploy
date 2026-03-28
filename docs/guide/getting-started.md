# Getting Started

## Installation

```bash
npm install @jrmc/catapult
```

Once installed, the `cata` CLI is available:

```bash
cata deploy
```

## Usage

Generate a `deploy.ts` file at the root of your project:

```bash
cata init
```

Or create it manually:

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
# Show the current version
cata version
cata -v

# Create a deploy.ts configuration file
cata init

# Deploy
cata deploy

# Initial server setup (create directories)
cata deploy:setup

# Rollback to the previous release
cata rollback

# Server status
cata status

# List releases
cata list:releases

# List registered tasks and the current pipeline
cata list:tasks

# Run a specific task on servers
cata task <task-name>

# Target a specific host
cata deploy --host staging
```

## Server structure

After `cata deploy:setup`, the server will have the following structure:

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
cata deploy --host staging
```

## Automatic rollback

If a failure occurs after `deploy:publish`, an automatic rollback is triggered:
the previous release is restored and PM2 is reloaded if present in the pipeline.
