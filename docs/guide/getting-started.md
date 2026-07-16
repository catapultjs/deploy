---
description: Install Catapult, configure your hosts and deploy your Node.js application over SSH in minutes.
outline: deep
---

# Getting Started

## Installation

Run the following command at the root of your project:

```bash
npx @catapultjs/deploy init
```

Choose TypeScript, JavaScript or JSON when prompted. This creates `deploy.config.ts`, `deploy.config.js` or `deploy.config.json` and installs `@catapultjs/deploy` as a dev dependency by default. Pass `--skip-install` if you only want to generate the config file. If a supported deploy config file already exists, `init` only warns and does not overwrite it. Once installed, the `cata` CLI is available.

### 1. Prepare the server

Before the first deployment on a server, run:

```bash
npx cata deploy:setup
```

This command prepares the remote directory structure Catapult expects, such as `releases/`, `shared/`, and `.catapult/`, and runs any setup hooks registered by your recipes. It is non-destructive, so you can run it again safely if the structure is already in place.

You usually run it once per server.

### 2. Configure Catapult

Edit the generated config, or create it manually. TypeScript and JavaScript configs can use the complete programmatic API:

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

JSON is available when the deployment can be expressed as validated data:

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "recipes": ["git"],
  "config": {
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@example.com",
        "deployPath": "/home/deploy/myapp"
      }
    ]
  }
}
```

The JSON format supports built-in recipes, store values, declarative tasks and pipeline replacement, removal and placement. See [JSON configuration](/guide/json-configuration) for the complete schema-backed format and its executable-code limitations.

Catapult does not impose a deployment mode in either config format. A recipe or custom task must provide `deploy:update_code`:

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
