---
title: Use Catapult globally with a project config
date: 2026-09-13
author: Jérémy Chaufourier
description: Keep one global Catapult CLI and a small, versioned JSON deployment config in each project.
---

# Use Catapult globally with a project config

For small sites, I prefer installing Catapult once and keeping only the deployment configuration in the repository. The deployment remains reproducible: the host, release path, tasks and recipes are versioned with the project, without adding Catapult to every `package.json`.

Install the CLI globally:

```bash
npm install --global @catapultjs/deploy
```

Then run Catapult from the project directory as usual:

```bash
cata config:validate
cata deploy:setup
cata deploy
```

## A JSON config in the project

`edge-components.jrmc.dev` is a static AdonisJS site. Its `deploy.config.json` generates the site locally, uploads the resulting `static/` directory, then reloads Caddy:

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "recipes": ["systemd", "caddy"],
  "store": {
    "caddy_upload_path": "/etc/caddy/sites/example.com.caddy",
    "systemd_service": "caddy"
  },
  "config": {
    "keepReleases": 2,
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@example.com",
        "deployPath": "/home/deploy/example.com"
      }
    ]
  },
  "tasks": {
    "static:generate": {
      "steps": [{ "local": { "command": "npm run static:generate" } }]
    },
    "deploy:update_code": {
      "steps": [{ "upload": { "local": "static/.", "remote": "{{release_path}}" } }]
    }
  },
  "before": {
    "deploy:lock": "static:generate"
  },
  "after": {
    "deploy:publish": "caddy:reload"
  }
}
```

Catapult discovers `deploy.config.json` from the current directory. The schema URL gives editors completion and catches mistakes before a connection is opened. `cata config:validate` is a useful first check in a fresh clone or CI job.

The file contains no secrets: keep SSH credentials in your SSH configuration and use shared files for application secrets.

## JavaScript or JSON?

Both formats are useful, but they serve different workflows.

Use JSON when the deployment is declarative: built-in recipes, serializable settings, command steps and pipeline placement. It has no package imports, which makes it the right format for a global Catapult installation.

Use JavaScript or TypeScript when the deployment needs hooks, local recipes, conditions or arbitrary code. Those files import `@catapultjs/deploy`, so install Catapult in that project and run it with `npx cata`. That keeps the imported API and the config on the same version.

```bash
npm install --save-dev @catapultjs/deploy
npx cata deploy
```

The config stays in the repository in both cases. The choice is simply between a portable, schema-validated JSON file and the full flexibility of executable configuration. See the [JSON configuration guide](/guide/json-configuration) for the complete declarative format.
