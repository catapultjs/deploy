---
name: catapultjs
description: Work with Catapult (@catapultjs/deploy), the SSH deployment tool for Node.js. Use when creating or updating a deploy.ts config, writing recipes or deployment tasks, customizing the deploy pipeline, or scripting deployments with the programmatic API (Catapult class).
---

# Catapult (@catapultjs/deploy)

Capistrano-style SSH deployment for Node.js: versioned releases under `releases/`, an atomic `current` symlink, shared directories, a composable task pipeline, automatic rollback. The CLI is `cata`. Docs: https://catapultjs.com

## Critical rule

`deploy:update_code` uploads `source_path` by SCP by default. Import `recipes/git` or `recipes/rsync` only when you want to replace that delivery behavior. Do not combine delivery providers such as `git` and `rsync` unless the user explicitly defines the pipeline.

## References

Read the file matching the task before writing code:

| Task | Read |
| --- | --- |
| Create or update `deploy.ts`: hosts, recipe selection, healthchecks, lifecycle hooks, pipeline tuning, `setPipeline()` | [references/config.md](references/config.md) |
| Write or modify a recipe or deployment task: task DSL, `onSetup`/`onStatus` hooks, store options, `TaskRegistry` | [references/recipe.md](references/recipe.md) |
| Use an official recipe (git, rsync, nextjs, nuxt, astro, tanstack, nestjs, adonisjs, vitepress, directus, pm2, redis, caddy): tasks added, store keys, monorepo patterns | [references/recipes.md](references/recipes.md) |
| Script deployments from Node.js (scripts, CI, bots, dashboards) with the `Catapult` class | [references/api.md](references/api.md) |
| Set up a GitHub Actions workflow with `catapultjs/deploy-action`: inputs, SSH secrets, env vars | [references/github-actions.md](references/github-actions.md) |
| Use the `cata` CLI: deploy, rollback, task, status, run, ssh, list commands and their options | [references/cli.md](references/cli.md) |

When a change spans several areas (e.g. a config plus a custom recipe), read every matching reference.

## Interactive config workflow

When the user asks to create, initialize, or configure a Catapult deployment and the required facts are not already present in the repo or prompt, ask focused questions before writing `deploy.ts`.

Do not invent production values. At minimum, determine:

- app stack/recipe (`nextjs`, `nextjs_static`, `nuxt`, `astro`, `nestjs`, `tanstack`, `adonisjs`, etc.)
- code delivery mode (default SCP via `source_path`, `git`, `rsync`, local-build/static recipe, or custom)
- host name, SSH target, deploy path, and branch if using `git`
- process manager (`pm2` or none) and whether an `ecosystem.config.cjs` should be created
- `.env`/shared paths and optional healthcheck URL

Prefer one compact question group over a long interview. If the project files already answer some items, state the inferred values and ask only for the missing or ambiguous ones. After the user answers, generate the config and include the setup/deploy commands.
