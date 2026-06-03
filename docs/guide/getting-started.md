---
description: Install Catapult, configure your hosts and deploy your Node.js application over SSH in minutes.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# Getting Started

## Installation

Run the following command at the root of your project:

```bash
npx @catapultjs/deploy init
```

This creates a `deploy.(js|ts)` configuration file and installs `@catapultjs/deploy` as a dev dependency. If a supported deploy config file already exists, `init` only warns and does not overwrite it. Once installed, the `cata` CLI is available.

### 1. Prepare the server

Before the first deployment on a server, run:

```bash
npx cata deploy:setup
```

This command prepares the remote directory structure Catapult expects, such as `releases/`, `shared/`, and `.catapult/`, and runs any setup hooks registered by your recipes. It is non-destructive, so you can run it again safely if the structure is already in place.

You usually run it once per server.

### 2. Configure Catapult

Edit the generated `deploy.ts` file, or create it manually:

```typescript
import { defineConfig } from '@catapultjs/deploy'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})
```

This is the smallest useful configuration. For all available config and host options, see the [Configuration section in the API Reference](/guide/api#configuration).

Catapult does not impose a deployment mode in `defineConfig()`. A recipe or custom task must provide `deploy:update_code`:

- local artifact uploads use SCP by default
- `recipes/git` clones the repository into each release and keeps a mirror in `.catapult/repo`
- `recipes/rsync` pushes a local directory into the release with rsync

### 3. Deploy releases

Once your configuration is ready, deploy your application with:

```bash
npx cata deploy
```

Run `deploy` for each new release after the initial setup.

For the full command reference with one page per command, see the [CLI guide](/guide/cli/).

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
