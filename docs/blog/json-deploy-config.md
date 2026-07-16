---
title: A JSON deploy config for Catapult
date: 2026-07-16
author: Jérémy Chaufourier
description: Catapult now supports strict JSON deploy configs with schema validation, built-in recipes, declarative tasks and global CLI installs.
---

# A JSON deploy config for Catapult

Catapult started with TypeScript and JavaScript configuration files. That remains the most flexible option when a deployment needs custom code, callbacks or project-local recipes.

But many deployments are data-only: a list of hosts, a few built-in recipes, some shared paths, and small task or pipeline adjustments. For those cases, Catapult now supports strict JSON configuration with schema validation.

## A declarative config file

Create `deploy.config.json` at the root of your project:

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "recipes": ["git", "pm2"],
  "config": {
    "keepReleases": 3,
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@example.com",
        "deployPath": "/home/deploy/myapp",
        "branch": "main"
      }
    ]
  },
  "store": {
    "shared_files": [".env"],
    "shared_dirs": ["storage", "logs"]
  }
}
```

This file is plain JSON: double-quoted keys and strings, no comments, no trailing commas. Catapult validates the document before running any command that needs a deploy config.

The `$schema` field is for editors. It enables completion and validation without requiring Catapult to execute the file.

## Built-in recipes without imports

In TypeScript, recipes are loaded with imports:

```typescript
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'
```

In JSON, use recipe names instead:

```json
{
  "recipes": ["git", "pm2"]
}
```

The list is intentionally limited to built-in recipes. External and project-local recipes execute code, so they still belong in TypeScript or JavaScript configs.

## Tasks and pipeline controls

JSON can also register simple tasks:

```json
{
  "tasks": {
    "app:build": {
      "description": "Install dependencies and build the application",
      "steps": [{ "cd": "{{release_path}}" }, { "run": "npm ci" }, { "run": "npm run build" }]
    }
  },
  "after": {
    "deploy:shared": "app:build"
  }
}
```

Pipeline controls map to the same concepts as the programmatic API:

- `pipeline` replaces the full pipeline, like `setPipeline()`
- `remove` removes existing pipeline tasks
- `before` inserts tasks before a target task
- `after` inserts tasks after a target task

The final pipeline is validated. Unknown tasks, missing targets and empty pipelines fail before deployment.

## Why this helps global installs

With TypeScript or JavaScript configs, the project usually needs `@catapultjs/deploy` installed locally because the config imports from the package:

```typescript
import { defineConfig } from '@catapultjs/deploy'
```

JSON has no package imports. That means the CLI can be installed globally and still load the project config:

```bash
npm install --global @catapultjs/deploy
cata init
cata config:validate
cata deploy
```

This is useful for small projects, documentation sites, internal tools or servers where you want one global Catapult install and lightweight repository configs.

You can still install Catapult locally when you want reproducible per-project tooling:

```bash
npm install --save-dev @catapultjs/deploy
npx cata init
npx cata deploy
```

Both workflows use the same JSON format.

## Validate before deploying

The new `config:validate` command checks that Catapult can load and initialize the config without connecting to hosts:

```bash
cata config:validate
cata config:validate --json
```

It validates the JSON schema, built-in recipe names, store values, task steps and pipeline wiring. It does not validate SSH access, server permissions or remote binaries.

Use it in CI when you want a fast configuration check before a deployment job.

## When to keep TypeScript

Use TypeScript or JavaScript when the deployment needs executable behavior:

- lifecycle hooks
- external or local recipes
- conditional pipeline changes
- dynamic binary resolution inside custom tasks
- loops, API calls or custom async code

Use JSON when the deployment is fully describable as data. The format is stricter, easier to validate, and works well with global CLI installs.

See the [JSON configuration guide](/guide/json-configuration) for the complete schema-backed format.
