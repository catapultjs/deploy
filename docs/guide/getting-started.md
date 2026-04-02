---
description: Install Catapult, configure your hosts and deploy your Node.js application over SSH in minutes.
---

# Getting Started

## Installation

Run the following command at the root of your project:

```bash
npx @catapultjs/deploy init
```

This creates a `deploy.ts` configuration file and installs `@catapultjs/deploy` as a dev dependency. Once installed, the `cata` CLI is available:

```bash
npx cata deploy
```

## Configuration

Edit the generated `deploy.ts` file, or create it manually:

```typescript
import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'

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
      branch: {
        name: 'develop',
        ask: true,
      },
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
npx cata version

# Create a deploy.ts configuration file
npx cata init

# Initial server setup (create directories)
npx cata deploy:setup

# Deploy
npx cata deploy

# Rollback to the previous release
npx cata rollback

# Server status
npx cata status

# List releases
npx cata list:releases

# Show the current deployment pipeline
npx cata list:pipeline

# List registered tasks
npx cata list:tasks

# Run a specific task on servers
npx cata task <task-name>

# Open an interactive SSH session on a host
npx cata ssh

# Target a specific host
npx cata deploy --host staging

# Override the branch to deploy
npx cata deploy --branch feature/my-feature
```

## SSH

The `ssh` option accepts a connection string or an object:

**Connection string:**

```typescript
ssh: 'deploy@example.com'
```

**Object — useful for non-standard ports:**

```typescript
ssh: {
  user: 'deploy',
  host: 'example.com',
  port: 2222,
}
```

## Branch

The `branch` option on a host accepts a plain string or an object for interactive prompting.

**Static branch:**

```typescript
hosts: [
  {
    name: 'production',
    ssh: 'deploy@example.com',
    deployPath: '/home/deploy/myapp',
    branch: 'main',
  },
]
```

**Interactive prompt** — asks which branch to deploy at runtime, with a default value:

```typescript
hosts: [
  {
    name: 'production',
    ssh: 'deploy@example.com',
    deployPath: '/home/deploy/myapp',
    branch: { name: 'main', ask: true },
  },
]
```

You can also override the branch for all hosts at deploy time:

```bash
npx cata deploy --branch feature/my-feature
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

When multiple hosts are configured, most commands prompt you to select which host(s) to target:

```
? Select hosts  ›  Space to select. Return to submit.
❯ ◯ staging
  ◯ production
```

To skip the prompt and target a specific host directly:

```bash
npx cata deploy --host staging
```

The `--host` flag is available on all commands: `deploy`, `deploy:setup`, `rollback`, `status`, `list:releases`, `task`.

## Automatic rollback

If a failure occurs after `deploy:publish`, an automatic rollback is triggered:
the previous release is restored and PM2 is reloaded if present in the pipeline.
