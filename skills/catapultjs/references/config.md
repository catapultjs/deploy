# Writing a Catapult deploy config

The config file is auto-detected as `deploy.ts`, `deploy.js`, `deploy.config.ts` or `deploy.config.js` at the project root (override with `cata --config <path>`). It must default-export `defineConfig()`. Full reference: https://catapultjs.com/guide/api

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
      branch: 'main',
    },
  ],
})
```

## Critical rule: code delivery

`defineConfig()` does not impose a deployment mode. The pipeline task `deploy:update_code` MUST be provided by exactly one recipe (or a custom task), otherwise the deploy fails. Pick one:

| Recipe | Delivery | Use for |
| --- | --- | --- |
| `recipes/git` | Clones the repo on the server (bare mirror in `.catapult/repo`) | Server can reach the repo, build on server |
| `recipes/rsync` | Pushes a local directory into the release | Local builds, no repo access from server |
| `recipes/adonisjs_local` | Builds AdonisJS locally, uploads the artifact | AdonisJS without building on the server |
| `recipes/astro` / `recipes/vitepress` | Builds locally, uploads the static output | Static sites |
| custom `task('deploy:update_code', …)` | Whatever you implement | Anything else |

## Picking recipes by stack

Inspect the project (`package.json`, lock file, config files) before choosing:

- **AdonisJS**: `adonisjs` (installs and builds on the server, exposes `ace:*` migration tasks) or `adonisjs_local` (build locally, upload). Both need a delivery recipe only in the `adonisjs` case (pair it with `git`).
- **Nuxt**: `nuxt` (exposes `deploy:build` and `nuxt:generate`), pair with `git`.
- **Astro / VitePress**: `astro` / `vitepress` alone (they handle delivery).
- **Process manager**: add `pm2` if the app runs under PM2 (`ecosystem.config.cjs` expected in the project). It wires restart after publish and adds `pm2:*` tasks plus a status report.
- **Extras**: `directus` (DB migrations and schema snapshots), `redis` (`redis:db:flush*` tasks, configure with `set('redis_db', n)`).

Recipes register their tasks at import time: imports must appear before or inside the config file, never lazily.

## Config options

| Option | Type | Notes |
| --- | --- | --- |
| `hosts` | `Host[]` | Required |
| `keepReleases?` | `number` | Default `5` |
| `repository?` | `string` | Auto-detected from git origin |
| `packageManager?` | `PackageManager` | Auto-detected from lock file |
| `hooks?` | `Hooks` | See below |
| `verbose?` | `Verbose` | From `@catapultjs/deploy/enums`: `SILENT`, `NORMAL`, `TRACE` (default), `DEBUG` |

## Host options

| Option | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Identifier used by `--host` / `hosts:` selectors |
| `ssh` | `string \| SshConfig` | `'user@host'` or `{ user, host, port? }` |
| `deployPath` | `string` | Absolute path on the server |
| `branch?` | `string \| { name, ask }` | `ask: true` prompts at deploy time (CLI only) |
| `healthcheck?` | `{ url?, retries?, delayMs? }` | Curl check after publish; the `deploy:healthcheck` task is removed automatically when no host defines a `url` |
| `bin?` | `Record<string, string>` | Per-host binary paths, e.g. `{ node: '/home/deploy/.nvm/versions/node/v24.0.0/bin/node' }`. Needed when binaries are not on the non-interactive SSH PATH (nvm setups) |

Multiple environments are just multiple hosts (`production`, `staging`); target one with `cata deploy -H staging`.

## Lifecycle hooks

All optional, all `(ctx: { host?, hosts?, error? }) => Promise<void>`:

```typescript
export default defineConfig({
  hosts: […],
  hooks: {
    beforeDeploy: async ({ hosts }) => {},      // once, before all hosts
    beforeHostDeploy: async ({ host }) => {},   // per host
    afterHostDeploy: async ({ host }) => {},    // per host, even on failure
    afterFailure: async ({ hosts, error }) => {}, // on error, before rethrow
    afterDeploy: async ({ hosts }) => {},       // once, after success
  },
})
```

## Pipeline customisation

The config file is a regular module: pipeline and store calls work alongside `defineConfig()`.

Default pipeline order: `deploy:lock` → `deploy:release` → `deploy:update_code` → `deploy:shared` → `deploy:publish` → `deploy:log_revision` → `deploy:healthcheck` → `deploy:unlock` → `deploy:cleanup`. Inspect with `cata pipeline`. Reference: https://catapultjs.com/guide/pipeline

Three built-in tasks are registered but NOT inserted by default. Insert them instead of writing custom install/build/test tasks:

```typescript
import { after } from '@catapultjs/deploy'

after('deploy:update_code', 'deploy:install') // package manager install
after('deploy:install', 'deploy:build')      // pm run build
after('deploy:build', 'deploy:test')         // pm run test
```

Pipeline functions: `after(existing, task)`, `before(existing, task)`, `remove(name)`, `inPipeline(name)` to place a task relative to optional steps, `setPipeline([…])` to replace the whole sequence. Insertion deduplicates: re-adding a task moves it, the last position wins.

```typescript
import { set, after, inPipeline, remove, task, run, cd } from '@catapultjs/deploy'

set('writable_dirs', ['logs', 'tmp/uploads'])  // created under shared/ at setup
set('shared_files', ['.env'])                   // touched under shared/ at setup
set('rsync_source_path', './dist')              // rsync recipe option

task('app:warmup', () => {
  cd('{{current_path}}')
  run('curl -s localhost:3333/health')
})

// healthcheck is removed automatically when no host defines one
if (inPipeline('deploy:healthcheck')) {
  after('deploy:healthcheck', 'app:warmup')
} else {
  after('deploy:publish', 'app:warmup')
}
```

Custom tasks can also be async functions receiving the `TaskContext` (e.g. `fetch` a Slack webhook with the `release` name). Run any registered task manually with `cata task <name>`.

### Rewriting the whole pipeline

`setPipeline()` replaces the sequence entirely, for full control over the order:

```typescript
import { defineConfig, setPipeline } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/pm2'

setPipeline([
  'deploy:lock',
  'deploy:release',
  'deploy:update_code',
  'deploy:install',
  'deploy:build',
  'deploy:shared',
  'deploy:publish',
  'pm2:startOrReload',
  'deploy:unlock',
  'deploy:cleanup',
])

export default defineConfig({ hosts: […] })
```

Rules:

- Call it AFTER the recipe imports: recipes run their own `after()`/`before()` insertions at import time, and `setPipeline()` must have the last word.
- Every name must be a registered task (built-in or from an imported recipe), otherwise the deploy fails at that step with "Task not found".
- Keep `deploy:lock`/`deploy:unlock` unless concurrent deploys are acceptable, and `deploy:log_revision` if `list:revisions` and revision metadata matter.
- Omitting `deploy:cleanup` disables release pruning (`keepReleases` has no effect then).

## Checklist

1. `defineConfig()` is the default export.
2. Exactly one provider for `deploy:update_code` is imported (or defined).
3. Recipe store options (`set(…)`) match the imported recipes.
4. Healthcheck URLs point to an endpoint reachable from the server itself.
5. Pin the package version in `package.json` (the API is still in beta).
6. Verify with `cata pipeline` (task order) and `cata list:tasks` (registered tasks), then `cata deploy:setup` before the first deploy.
