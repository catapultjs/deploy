# Catapult

[![npm version](https://img.shields.io/npm/v/@catapultjs/deploy)](https://www.npmjs.com/package/@catapultjs/deploy)
[![node version](https://img.shields.io/node/v/@catapultjs/deploy)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@catapultjs/deploy)](https://github.com/catapultjs/deploy/blob/main/LICENSE)

A Capistrano-style deployment tool for Node.js — versioned releases, shared directories, composable task pipeline, automatic rollback. No agent, no container, no server-side dependency, just SSH.

Full documentation at **https://catapultjs.com/**

## Features

- **SSH-based** — deploys directly over SSH; nothing to install on the server beyond a remote shell
- **Versioned releases** — every deploy goes into `releases/<timestamp>`, activated by an atomic `current` symlink, with automatic rollback on failure
- **Composable pipeline** — insert, remove or replace any task with a single function call, or rewrite the whole sequence
- **Drop-in recipes** — import once, tasks register themselves and wire into the pipeline
- **Multi-host** — deploy to one server or several, with per-host configuration
- **Healthcheck** — verify the app responds after a deploy, with automatic rollback on failure

## Quick start

Run `init` at the root of your project — it creates a `deploy.ts` config file and installs `@catapultjs/deploy` as a dev dependency:

```bash
npx @catapultjs/deploy init
```

Edit `deploy.ts` to describe your hosts and pick your recipes:

```typescript
import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'

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

Prepare the server (once per host), then deploy:

```bash
npx cata deploy:setup
npx cata deploy
```

## Server structure

```
/home/deploy/myapp/
  current/          → symlink to releases/<release>
  releases/
    2024-01-15T.../ ← active release
    2024-01-14T.../
  shared/
    .env
    logs/
  .catapult/
    repo/           ← bare git mirror (git recipe)
    revisions.log   ← JSON deployment history
    deploy.lock     ← present during a deployment
```

## Recipes

| Recipe           | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `git`            | Clones the repository into each release, keeps a bare mirror on the server |
| `rsync`          | Pushes a local directory into the release with rsync                        |
| `pm2`            | Start, reload and manage PM2 processes                                      |
| `adonisjs`       | Install, build and migration tasks for AdonisJS apps                        |
| `adonisjs_local` | Builds the AdonisJS app locally, uploads the artifact                       |
| `astro`          | Builds locally with `astro build`, uploads the output                       |
| `nuxt`           | Build tasks for Nuxt apps                                                   |
| `vitepress`      | Builds locally with `vitepress build`, uploads the static files             |
| `directus`       | Directus database migration and schema snapshot tasks                       |
| `redis`          | Flush one, many or all Redis databases                                      |

## Requirements

- Node.js >= 24 on the machine running Catapult
- SSH key-based access to the target servers

## Agent skill

The package ships a [`catapultjs` agent skill](https://catapultjs.com/guide/agent-skills) for Claude Code and SKILL.md-compatible agents, with references covering the deploy config, recipe writing and the programmatic API.

```bash
npx skills add catapultjs/deploy
```

## Contributing a recipe

If you've written a recipe that could be useful to others, open a pull request and add it to the [`contrib/`](https://github.com/catapultjs/deploy/tree/main/contrib) directory.

## Inspiration

Inspired by [Deployer PHP](https://deployer.org) and [Capistrano](https://capistranorb.com).

## License

[MIT](https://github.com/catapultjs/deploy/blob/main/LICENSE)
