---
description: Use Catapult as a library to deploy, roll back and inspect servers from your own Node.js code with the Catapult class.
outline: deep
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# Programmatic usage

Everything the CLI does is also available as a library, through the `Catapult` class. Use it to drive deployments from your own scripts, a CI runner, a bot or a dashboard.

```typescript
import { Catapult } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'

const catapult = new Catapult({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})

await catapult.deploy()
```

The constructor accepts the exact same configuration object as [`defineConfig()`](/guide/api#defineconfig-config): hosts, recipes, hooks and pipeline customisations all work the same way. Import recipes before constructing, like in a `deploy.ts`.

The deploy context is global: use **a single `Catapult` instance per process**. Parallel deployments to multiple hosts of the same instance are fine; two instances with different configs in the same process are not supported.

## Methods

Methods that target servers accept an `options` object with a `hosts` array of host names. Without it, they run against every configured host, with no interactive prompt. Unknown host names throw before anything runs.

### `setup(options?)`

Prepares the remote directory structure (`releases/`, `shared/`, `.catapult/`) and runs the recipes' [`onSetup`](/guide/api#onsetup-fn) hooks. Equivalent to `cata deploy:setup`. Run it once per host; it is non-destructive.

```typescript
await catapult.setup()
await catapult.setup({ hosts: ['production'] })
```

**Options**

| Option   | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| `hosts?` | `string[]` | Host names to target (default: all configured hosts) |

### `deploy(options?)`

Deploys a new release by running the full task pipeline, exactly like `cata deploy`. The release name is generated when the method is called, so a long-lived instance can deploy repeatedly.

```typescript
await catapult.deploy()
await catapult.deploy({ hosts: ['production'] })
```

If a host is not initialized, the method throws and asks you to run `setup()` first, instead of prompting. On a task failure, the same auto-rollback as the CLI applies, then the error is rethrown. The `beforeDeploy`, `afterDeploy` and `afterFailure` [hooks](/guide/hooks) from the configuration run as usual.

**Options**

| Option   | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| `hosts?` | `string[]` | Host names to target (default: all configured hosts) |

### `task(name, options?)`

Runs a single registered task on the selected hosts, against the currently deployed release. Equivalent to `cata task <name>`. The task must be registered first: import the recipe that provides it, or define it with [`task()`](/guide/api#task-name-fn) before calling.

```typescript
import '@catapultjs/deploy/recipes/pm2'

await catapult.task('pm2:restart')

const [{ output }] = await catapult.task('pm2:logs', { hosts: ['production'] })
console.log(output) // the last 50 log lines from the server
```

The method returns one entry per host with everything the task wrote through its `logger`. Display tasks like `pm2:logs`, `pm2:list` or `pm2:show` report their result this way, so in API mode nothing is printed and the output is yours to use:

```typescript
const results = await catapult.task('pm2:logs', { hosts: ['production'] })
// [
//   { host: 'production', output: '…the last 50 log lines…' }
// ]
```

The captured text may contain ANSI color codes. Tasks built from queued [`run()`](/guide/api#run-command) commands produce an empty `output`, since their remote stdout is streamed rather than captured.

Throws if the task is unknown, if a host is not initialized, or if no release is deployed yet.

**Options**

| Option   | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| `hosts?` | `string[]` | Host names to target (default: all configured hosts) |

### `rollback(options?)`

Points the `current` symlink back to a previous release. Without `release`, the release preceding the current one is used.

```typescript
await catapult.rollback()
await catapult.rollback({ hosts: ['production'], release: '2026-06-10T08-30-00-000Z' })
```

**Options**

| Option     | Type       | Description                                            |
| ---------- | ---------- | ------------------------------------------------------ |
| `hosts?`   | `string[]` | Host names to target (default: all configured hosts)      |
| `release?` | `string`   | Release name to roll back to (default: the previous one) |

### `status(options?)`

Returns the same data as `cata status --json`: one entry per host with the active release, healthcheck result, runtime versions, last revision, lock state, and any data returned by the recipes' [`onStatus`](/guide/api#onstatus-fn) hooks. SSH failures are captured in the `error` field of the affected host instead of being thrown.

```typescript
const report = await catapult.status()
// [
//   {
//     name: 'production',
//     release: '2026-06-10T08-30-00-000Z',
//     health: 'ok',
//     node: 'v24.0.0',
//     packageManager: { name: 'pnpm', version: '10.0.0' },
//     pm2: '6.0.5',
//     revision: { branch: 'main', commit: '79af068…', user: 'jeremy', date: '…' },
//     lock: null,
//   },
// ]
```

**Options**

| Option   | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| `hosts?` | `string[]` | Host names to target (default: all configured hosts) |

### `listReleases(options?)`

Lists the releases present on each host, newest first, with the active one. Returns the same data as `cata list:releases --json`.

```typescript
const hosts = await catapult.listReleases()
// [{ name: 'production', current: '2026-06-10T…', releases: ['2026-06-10T…', '2026-06-09T…'] }]
```

**Options**

| Option   | Type       | Description                                       |
| -------- | ---------- | ------------------------------------------------- |
| `hosts?` | `string[]` | Host names to target (default: all configured hosts) |

### `listRevisions(options?)`

Lists the last deployments recorded in `.catapult/revisions.log`, newest first. Returns the same data as `cata list:revisions --json`.

```typescript
const hosts = await catapult.listRevisions({ limit: 5 })
// [{ name: 'production', revisions: [{ release, branch, commit, user, date }, …] }]
```

**Options**

| Option   | Type       | Description                                          |
| -------- | ---------- | ---------------------------------------------------- |
| `hosts?` | `string[]` | Host names to target (default: all configured hosts)    |
| `limit?` | `number`   | Maximum number of revisions per host (default: `10`) |

### `listTasks()`

Lists the registered tasks, split between those in the pipeline and the extra ones. Returns the same data as `cata list:tasks --json`.

```typescript
const { pipeline, extra } = await catapult.listTasks()
// pipeline: [{ name: 'deploy:lock', description: '…' }, …]
// extra:    [{ name: 'pm2:logs', description: '…' }, …]
```

### `pipeline()`

Returns the current deployment pipeline as an ordered array of task names, like `cata pipeline --json`.

```typescript
const tasks = await catapult.pipeline()
// ['deploy:lock', 'deploy:release', …, 'deploy:cleanup']
```

## Events

`Catapult` is an `EventEmitter`. During `deploy()` and `task()` it emits:

| Event | Payload | When |
| --- | --- | --- |
| `task:start` | `{ host, task }` | Before each pipeline task |
| `task:done` | `{ host, task }` | After each successful task |
| `task:error` | `{ host, task, error }` | When a task fails |
| `host:done` | `{ host, release }` | After a host is fully deployed |

```typescript
catapult.on('task:start', ({ host, task }) => {
  console.log(`[${host}] ${task}…`)
})

catapult.on('host:done', ({ host, release }) => {
  notifySlack(`${host} is now on ${release}`)
})
```

## Controlling log output

By default Catapult logs task progress to stdout, like the CLI. For a fully silent run where you rely on events and return values only, set the verbosity in the configuration:

```typescript
import { Verbose } from '@catapultjs/deploy/enums'

const catapult = new Catapult({
  verbose: Verbose.SILENT,
  hosts: [...],
})
```

## Lower-level functions

If the `Catapult` class is too coarse, the underlying primitives are exported from the main entry point: `deployHost()`, `rollbackHost()`, `initializeHost()`, `isHostSetup()`, `getCurrentRelease()`, `getReleaseNames()`, `getRevisions()` and `collectHostStatus()` all take an explicit `DeployContext` and `Host`. See the [API Reference](/guide/api).

## Agent skill

The package ships a `catapultjs` skill that teaches this API (methods, return shapes, events, silent mode) to Claude Code and any agent supporting the SKILL.md format. Copy it into your project to get assisted scripting:

```bash
mkdir -p .claude/skills
cp -r node_modules/@catapultjs/deploy/skills/catapultjs .claude/skills/
```

See the [Agent skill](/guide/agent-skills) page for details.
