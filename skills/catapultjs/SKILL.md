---
name: catapultjs
description: Work with Catapult (@catapultjs/deploy), the SSH deployment tool for Node.js. Use when creating or updating a deploy.ts config, writing recipes or deployment tasks, customizing the deploy pipeline, or scripting deployments with the programmatic API (Catapult class).
---

# Catapult (@catapultjs/deploy)

Capistrano-style SSH deployment for Node.js: versioned releases under `releases/`, an atomic `current` symlink, shared directories, a composable task pipeline, automatic rollback. The CLI is `cata`. Docs: https://catapultjs.com

## Critical rule

`defineConfig()` does not impose a deployment mode: exactly one recipe (or a custom task) must provide the `deploy:update_code` pipeline task. Providers: `recipes/git`, `recipes/rsync`, `recipes/adonisjs_local`, `recipes/astro`, `recipes/vitepress`, or your own `task('deploy:update_code', …)`. A config without one fails at deploy time.

## References

Read the file matching the task before writing code:

| Task | Read |
| --- | --- |
| Create or update `deploy.ts`: hosts, recipe selection, healthchecks, lifecycle hooks, pipeline tuning, `setPipeline()` | [references/config.md](references/config.md) |
| Write or modify a recipe or deployment task: task DSL, `onSetup`/`onStatus` hooks, store options, `TaskRegistry` | [references/recipe.md](references/recipe.md) |
| Use an official recipe (git, rsync, astro, vitepress, adonisjs, nuxt, directus, pm2, redis): tasks added, store keys, monorepo patterns | [references/recipes.md](references/recipes.md) |
| Script deployments from Node.js (scripts, CI, bots, dashboards) with the `Catapult` class | [references/api.md](references/api.md) |
| Set up a GitHub Actions workflow with `catapultjs/deploy-action`: inputs, SSH secrets, env vars | [references/github-actions.md](references/github-actions.md) |
| Use the `cata` CLI: deploy, rollback, task, status, run, ssh, list commands and their options | [references/cli.md](references/cli.md) |

When a change spans several areas (e.g. a config plus a custom recipe), read every matching reference.
