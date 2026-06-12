---
description: Catapult ships a Claude Code agent skill with progressive references, for assisted config writing, recipe authoring and programmatic API scripting.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

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

The skill uses progressive disclosure: a small `SKILL.md` carries the universal rules (notably that one recipe must provide `deploy:update_code`) and routes the agent to a reference file matching the task. References are only read when needed, keeping the agent's context small.

| Reference | Covers |
| --- | --- |
| `references/config.md` | Creating and evolving `deploy.ts`: all config and host options, recipe selection by stack, healthchecks, lifecycle hooks, store options, pipeline tuning and `setPipeline()` |
| `references/recipe.md` | Writing recipes: conventions, task DSL, `TaskContext`, pipeline insertion, `onSetup`/`onStatus` hooks, `TaskRegistry` augmentation, pre-publication checklist |
| `references/api.md` | Scripting with the [programmatic API](/guide/programmatic): the `Catapult` class, methods with return shapes and CLI equivalents, events, output capture, silent mode |

See [Getting Started](/guide/getting-started), [Creating a Recipe](/guide/creating-recipes) and [Programmatic usage](/guide/programmatic) for the underlying guides.

## Keeping the skill up to date

With the `skills` CLI:

```bash
npx skills update catapultjs
```

If you copied it from `node_modules`, the skill is versioned with the package: after upgrading `@catapultjs/deploy`, copy it again so it matches the installed version:

```bash
cp -r node_modules/@catapultjs/deploy/skills/catapultjs .claude/skills/
```
