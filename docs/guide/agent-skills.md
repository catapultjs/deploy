---
description: Catapult ships a Claude Code agent skill with progressive references covering config, recipes, the programmatic API, the CLI and GitHub Actions integration.
---

# Agent skill

The npm package ships a `catapultjs` agent skill: instruction files that teach an AI coding agent how to work with Catapult correctly. It follows the SKILL.md format used by Claude Code and other compatible agents.

Once installed in your project, the agent loads the skill automatically when the task matches: ask it to "configure deployment for this project", "write a recipe for Meilisearch" or "script a deploy with a Slack notification" and it applies Catapult's conventions instead of guessing.

## Installation

The easiest way is the [`skills` CLI](https://skills.sh), which installs from the GitHub repository for Claude Code, Cursor, Codex and many other agents:

```bash
npx skills add catapultjs/deploy
```

Alternatively, the skill ships in the npm package: copy it from `node_modules` into your project's skill directory:

```bash
mkdir -p .claude/skills
cp -r node_modules/@catapultjs/deploy/skills/catapultjs .claude/skills/
```

You can also place it in `~/.claude/skills/` to make it available across all your projects.

## How it is organised

The skill uses progressive disclosure: a small `SKILL.md` carries the universal rules (notably that core SCP provides `deploy:update_code` by default and transfer recipes replace it) and routes the agent to a reference file matching the task. References are only read when needed, keeping the agent's context small.

| Reference                      | Covers                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/config.md`         | Creating and evolving TypeScript, JavaScript or JSON configs: format selection, config and host options, recipe selection, healthchecks, store values, tasks and pipeline tuning  |
| `references/recipe.md`         | Writing recipes: conventions, task DSL, `TaskContext`, pipeline insertion, `onSetup`/`onStatus`/rollback hooks, `sshPipe`, `TaskRegistry` augmentation, pre-publication checklist |
| `references/recipes.md`        | Using official recipes (git, rsync, astro, vitepress, adonisjs, nuxt, directus, pm2, redis, caddy, systemd): tasks added, store keys, monorepo patterns                           |
| `references/api.md`            | Scripting with the [programmatic API](/guide/programmatic): the `Catapult` class, methods with return shapes and CLI equivalents, events, output capture, silent mode             |
| `references/github-actions.md` | Setting up a GitHub Actions workflow with `catapultjs/deploy-action`: inputs, SSH secrets, env vars                                                                               |
| `references/cli.md`            | The `cata` CLI: all commands, flags, global options and config loading                                                                                                            |

See [Getting Started](/guide/getting-started), [JSON configuration](/guide/json-configuration), [Creating a Recipe](/guide/creating-recipes), [Programmatic usage](/guide/programmatic) and [CI/CD](/guide/ci-cd) for the underlying guides.

## Keeping the skill up to date

With the `skills` CLI:

```bash
npx skills update catapultjs
```

If you copied it from `node_modules`, upgrading the package does not update your copy. Copy it again after upgrading `@catapultjs/deploy`:

```bash
cp -r node_modules/@catapultjs/deploy/skills/catapultjs .claude/skills/
```

### Date-based version

The skill declares its own version in the frontmatter of `skills/catapultjs/SKILL.md`:

```yaml
metadata:
  version: '2026-11-06.1'
```

The format is `YYYY-MM-DD.N`: the UTC date of the update, followed by a revision number starting at `1`. A new change set on the same day increments the revision; a later date starts again at `1`. This version covers `SKILL.md` and all bundled references, independently of the npm package version.

Compare `metadata.version` in your installed copy with the source you use to update it. Compare the date first, then the revision numerically. Copy the entire skill directory when updating so the entrypoint and references stay together. The value above illustrates the format; the skill frontmatter is the source of truth for the current version.
