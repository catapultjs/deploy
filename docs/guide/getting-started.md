---
description: Install Catapult, configure your hosts and deploy your Node.js application over SSH in minutes.
outline: deep
---

# Getting Started

## Prerequisites

- Node.js 24 or newer on the machine running Catapult, plus the package manager used by your project
- Local OpenSSH tools (`ssh` and `scp`), with SSH access to a server where the deploy user can write to `deployPath`
- A remote Bash shell and the Unix tools used by the selected recipes. The Git recipe needs Git; rsync needs rsync on both machines
- For server applications, a compatible Node.js runtime and a configured process manager such as PM2 or systemd. Static sites need a web server instead

Install your project dependencies locally before using a local-build recipe. See [Recipes](/guide/recipes/) to choose where the build runs and how files are transferred.

## Installation

Run the following command at the root of your project:

```bash
npx @catapultjs/deploy init
```

Choose TypeScript, JavaScript or JSON when prompted. This creates `deploy.config.ts`, `deploy.config.js` or `deploy.config.json` and installs `@catapultjs/deploy` as a dev dependency by default. Pass `--skip-install` if you only want to generate the config file. If a supported deploy config file already exists, `init` only warns and does not overwrite it. Once installed, the `cata` CLI is available.

### 1. Configure Catapult

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

This configuration uploads the current directory. It does not install dependencies, build the application or start a service. Add the appropriate [application and process-manager recipes](/guide/recipes/) for those steps. For all available config and host options, see the [Configuration section in the API Reference](/guide/api#configuration).

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
        "deployPath": "/home/deploy/myapp",
        "branch": "main"
      }
    ]
  }
}
```

The JSON format supports built-in recipes, store values, declarative tasks and pipeline replacement, removal and placement. See [JSON configuration](/guide/json-configuration) for the complete schema-backed format and its executable-code limitations.

The built-in `deploy:update_code` uploads `source_path` via SCP (`./.` by default, meaning the current directory contents). No transfer recipe is required. Choose the source deliberately: recursive SCP does not apply Git ignore rules. A local-build recipe selects or prepares the upload artifact.

- local artifact uploads use SCP by default
- `recipes/git` clones the repository into each release and keeps a mirror in `.catapult/repo`
- `recipes/rsync` pushes a local directory into the release with rsync

### 2. Prepare the server

Before the first deployment on a server, run:

```bash
npx cata deploy:setup
```

This command prepares the remote directory structure Catapult expects, such as `releases/`, `shared/`, and `.catapult/`, and runs any setup hooks registered by your recipes. Directory creation is idempotent; review recipe setup hooks before rerunning them.

You usually run it once per server.

### 3. Deploy releases

Once your configuration is ready, deploy your application with:

```bash
npx cata deploy
```

Run `deploy` for each new release after the initial setup.

For the full command reference with one page per command, see the [CLI guide](/guide/cli/).

## Server structure

After deployments, the server has the following structure. Setup creates directories and configured shared paths; releases, symlinks and history appear during deployment:

```
/base/
  current/          → symlink to releases/<release>
  previous          → release replaced by the last publication
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
