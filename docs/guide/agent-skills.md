---
description: Catapult ships agent skills for Claude Code and SKILL.md-compatible agents, for assisted recipe writing and programmatic API scripting.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# Agent skills

The npm package ships three agent skills: short, focused instruction files that teach an AI coding agent how to work with Catapult correctly. They follow the SKILL.md format used by Claude Code and other compatible agents.

Once installed in your project, the agent loads the relevant skill automatically when the task matches: ask it to "write a recipe for Meilisearch" or "script a deploy with a Slack notification" and it applies Catapult's conventions instead of guessing.

## Installation

The skills live in `node_modules` once the package is installed. Copy them into your project's skill directory:

```bash
mkdir -p .claude/skills
cp -r node_modules/@catapultjs/deploy/skills/* .claude/skills/
```

You can also copy a single skill, or place them in `~/.claude/skills/` to make them available across all your projects.

## `cata-config`

Teaches the agent how to create and evolve a `deploy.ts` configuration:

- file detection, `defineConfig()` options and all host options (SSH, branch prompts, healthchecks, per-host binary paths)
- the critical rule that one recipe must provide `deploy:update_code`, with a decision table
- recipe selection by stack (AdonisJS, Nuxt, Astro, VitePress, PM2, Directus, Redis)
- lifecycle hooks, store options (`writable_dirs`, `shared_files`, recipe settings) and pipeline tuning from the config file
- a checklist with verification commands (`cata pipeline`, `cata list:tasks`)

See [Getting Started](/guide/getting-started) and the [API Reference](/guide/api) for the underlying guides.

## `cata-recipe`

Teaches the agent how to write and package recipes:

- naming conventions, `desc()`, quoting with `q()`, binary resolution with `bin()`
- the task DSL (`cd()`, `run()`, `local()`, `upload()`, `download()`) and the `TaskContext`
- pipeline insertion (`after()`, `before()`, `remove()`) and the default pipeline
- `onSetup()` and `onStatus()` hooks, including the data contract used by `status --json`
- recipe options through the store, `TaskRegistry` augmentation for TypeScript
- a pre-publication checklist and how to contribute to `contrib/`

See [Creating a Recipe](/guide/creating-recipes) for the underlying guide.

## `cata-api`

Teaches the agent how to build programs with the [programmatic API](/guide/programmatic):

- the `Catapult` class, its configuration and the one-instance-per-process rule
- all methods with their options, return shapes and CLI equivalents
- behavior differences from the CLI: no prompts, errors are thrown, output is returned
- deployment events, output capture from `task()`, silent mode with `Verbose.SILENT`
- the lower-level functions for advanced cases

## Keeping skills up to date

The skills are versioned with the package. After upgrading `@catapultjs/deploy`, copy them again so they match the installed version:

```bash
cp -r node_modules/@catapultjs/deploy/skills/* .claude/skills/
```
