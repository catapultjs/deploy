---
name: cata-api
description: Drive Catapult (@catapultjs/deploy) from Node.js code with the programmatic API. Use when building deploy scripts, CI runners, bots or dashboards that deploy, roll back, run tasks or inspect servers through the Catapult class instead of the cata CLI.
---

# Using the Catapult programmatic API

The `Catapult` class from `@catapultjs/deploy/api` exposes the same operations as the `cata` CLI, without any interactive prompt. Full docs: https://catapultjs.com/guide/programmatic

```typescript
import { Catapult } from '@catapultjs/deploy/api'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'

const catapult = new Catapult({
  hosts: [{ name: 'production', ssh: 'deploy@example.com', deployPath: '/home/deploy/myapp' }],
})

await catapult.deploy()
```

Rules that differ from a `deploy.ts`:

- Import recipes **before** constructing, exactly like in a config file.
- The constructor takes the same object as `defineConfig()`: `hosts`, `keepReleases`, `repository`, `packageManager`, `hooks`, `verbose`.
- One `Catapult` instance per process. The deploy context is global; a second instance with a different config is not supported.
- No prompts: methods either act or throw. Catch errors instead of expecting confirmation flows.

## Methods

All server-targeting methods accept `{ hosts?: string[] }` (default: all configured hosts; unknown names throw before anything runs).

| Method | Returns | CLI equivalent |
| --- | --- | --- |
| `setup(options?)` | `void` | `cata deploy:setup` |
| `deploy(options?)` | `void` | `cata deploy` |
| `rollback({ hosts?, release? })` | `void` | `cata rollback` |
| `task(name, options?)` | `TaskOutput[]` (`{ host, output }`) | `cata task <name>` |
| `status(options?)` | `HostStatus[]` | `cata status --json` |
| `listReleases(options?)` | `{ name, current, releases }[]` | `cata list:releases --json` |
| `listRevisions({ hosts?, limit? })` | `{ name, revisions }[]` | `cata list:revisions --json` |
| `listTasks()` | `{ pipeline, extra }` of `{ name, description }` | `cata list:tasks --json` |
| `pipeline()` | `string[]` | `cata pipeline --json` |

Behavior notes:

- `deploy()` generates a fresh release name on every call, runs the full pipeline, applies the CLI's auto-rollback on failure, then rethrows. Hosts must be initialized first (`setup()`), otherwise it throws.
- `task()` runs against the **currently deployed release** and returns what the task wrote through its `logger`, one entry per host. Display tasks (`pm2:logs`, `pm2:list`, …) report their result this way; output may contain ANSI codes. Tasks built from queued `run()` commands return an empty `output`.
- `status()` never throws on SSH failure; the affected host entry gets an `error` field instead. Data returned by recipes' `onStatus` hooks is merged into each host entry.

## Events

`Catapult` is an `EventEmitter`. `deploy()` and `task()` emit:

- `task:start`, `task:done` — `{ host, task }`
- `task:error` — `{ host, task, error }`
- `host:done` — `{ host, release }` (deploy only)

```typescript
catapult.on('host:done', ({ host, release }) => notify(`${host} → ${release}`))
```

## Silent mode

By default Catapult logs progress to stdout like the CLI. For programs that rely on events and return values only:

```typescript
import { Verbose } from '@catapultjs/deploy/enums'

const catapult = new Catapult({ verbose: Verbose.SILENT, hosts: […] })
```

## Lower-level functions

When the class is too coarse, the primitives are exported from `@catapultjs/deploy` and take an explicit `DeployContext` + `Host`: `deployHost()`, `rollbackHost()`, `initializeHost()`, `isHostSetup()`, `getCurrentRelease()`, `getReleaseNames()`, `getRevisions()`, `collectHostStatus()`, `runTask(name, ctx, host, { logger? })`.
