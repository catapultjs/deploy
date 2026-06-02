---
description: Install Catapult, configure your hosts and deploy your Node.js application over SSH in minutes.
---

# Getting Started

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
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

# Rollback and interactively select the target release
npx cata rollback --interactive
npx cata rollback -i

# Server status
npx cata status

# List releases
npx cata list:releases

# List the last 10 revisions (branch, commit, author, date)
npx cata list:revisions

# List registered tasks and the current pipeline
npx cata list:tasks

# Show the current deployment pipeline
npx cata pipeline

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
npx cata deploy -H staging

# Override the branch to deploy
npx cata deploy --branch feature/my-feature
npx cata deploy -b feature/my-feature

# Use an alternative config file
npx cata deploy --config deploy.production.ts
npx cata deploy -c deploy.staging.ts
```

## Configuration

Edit the generated `deploy.ts` file, or create it manually:

```typescript
import { defineConfig } from '@catapultjs/deploy'
import { PackageManager, Verbose } from '@catapultjs/deploy/enums'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'

export default defineConfig({
  keepReleases: 5, // optional, default: 5

  repository: 'git@github.com:user/myapp.git', // optional, auto-detected from origin

  packageManager: PackageManager.PNPM, // auto-detected from lock files if not set

  hosts: [
    {
      name: 'production',
      ssh: 'deploy@prod.example.com',
      deployPath: '/home/deploy/prod/myapp',
      branch: 'main', // required by the git recipe
      healthcheck: {
        url: 'http://127.0.0.1:3333/health',
        retries: 10,
        delayMs: 3000,
      },
    },
    {
      name: 'staging',
      ssh: 'deploy@staging.example.com',
      deployPath: '/home/deploy/staging/myapp',
      branch: {
        name: 'develop',
        ask: true,
      },
    },
  ],

  verbose: Verbose.NORMAL, // Verbose.SILENT | Verbose.NORMAL | Verbose.TRACE | Verbose.DEBUG
})
```

Catapult does not impose a deployment mode in `defineConfig()`. A recipe or custom task must provide `deploy:update_code`:

- local artifact uploads use SCP by default
- `recipes/git` clones the repository into each release and keeps a mirror in `.catapult/repo`
- `recipes/rsync` pushes a local directory into the release with rsync

## Server structure

After `cata deploy:setup`, the server will have the following structure:

```
/base/
  current/          → symlink to releases/<release>
  releases/
    2024-01-15T.../ ← active release
    2024-01-14T.../
  shared/
    .env
    logs/
    ...
  .catapult/
    repo/           ← bare git mirror (git recipe)
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
npx cata deploy -H staging
```

The `--host` / `-H` flag is available on all commands: `deploy`, `deploy:setup`, `rollback`, `status`, `list:releases`, `task`.

## Config file

By default, Catapult looks for `deploy.ts`, `deploy.config.ts`, `deploy.js`, or `deploy.config.js` in the current directory. Use `--config` / `-c` to point to a different file:

```bash
npx cata deploy --config deploy.production.ts
npx cata deploy -c deploy.staging.ts
```

The `--config` flag is available on all commands.

## Rollback

By default, `rollback` restores the previous release automatically:

```bash
npx cata rollback
```

To choose the target release interactively, use the `--interactive` (or `-i`) flag.
Catapult lists all available releases — the current one is marked and disabled — and prompts you to pick one:

```bash
npx cata rollback --interactive
npx cata rollback -i
```

## Automatic rollback

If a failure occurs after `deploy:publish`, an automatic rollback is triggered:
the previous release is restored and PM2 is reloaded if present in the pipeline.
