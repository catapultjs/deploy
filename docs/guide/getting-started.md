---
description: Install Catapult, configure your hosts and deploy your Node.js application over SSH in minutes.
---

# Getting Started

:::warning Alpha
`@catapultjs/deploy` is currently in alpha. Its API may change between minor releases until it reaches a stable version. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

## Installation

Run the following command at the root of your project:

```bash
npx @catapultjs/deploy init
```

This creates a `deploy.(js|ts)` configuration file and installs `@catapultjs/deploy` as a dev dependency. Once installed, the `cata` CLI is available:

```bash
npx cata deploy
```

## Configuration

Edit the generated `deploy.ts` file, or create it manually:

```typescript
import { defineConfig } from '@catapultjs/deploy'
import { Verbose } from '@catapultjs/deploy/enums'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({
  keepReleases: 5,

  repository: 'git@github.com:user/myapp.git', // optional, auto-detected from origin

  hosts: [
    {
      name: 'staging',
      ssh: 'deploy@staging.example.com',
      deployPath: '/home/deploy/staging/myapp',
      branch: {
        name: 'develop',
        ask: true,
      },
      healthcheck: {
        url: 'http://127.0.0.1:3333/health',
        retries: 10,
        delayMs: 3000,
      },
    },
    {
      name: 'production',
      ssh: 'deploy@prod.example.com',
      deployPath: '/home/deploy/prod/myapp',
      branch: 'main',
      healthcheck: {
        url: 'http://127.0.0.1:3333/health',
        retries: 10,
        delayMs: 3000,
      },
    },
  ],

  verbose: Verbose.NORMAL, // Verbose.SILENT | Verbose.NORMAL | Verbose.TRACE | Verbose.DEBUG
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

# Deploy with verbose output (-v level 1, -vv level 2, -vvv level 3)
npx cata deploy -v
npx cata deploy -vv
npx cata deploy -vvv

# Rollback to the previous release
npx cata rollback

# Server status
npx cata status

# List releases
npx cata list:releases

# List the last 10 revisions (branch, commit, author, date)
npx cata list:revisions

# Show the current deployment pipeline
npx cata pipeline

# List registered tasks
npx cata list:tasks

# Run a specific task on servers
npx cata task <task-name>

# Run a task with verbose output
npx cata task <task-name> -v

# Run a shell command on one or more hosts
npx cata run "pm2 list"
npx cata run "pm2 list" --host production

# Open an interactive SSH session on a host (opens in deployPath)
npx cata ssh

# Target a specific host
npx cata deploy --host staging

# Override the branch to deploy
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
  .catapult/
    repo/           ← bare git mirror (git recipe)
    builder/        ← build workspace (Strategy.BUILD)
    revisions.log   ← JSON deployment history
    deploy.lock     ← present during a deployment
```

## Multi-server

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
