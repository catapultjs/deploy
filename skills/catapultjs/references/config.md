# Writing a Catapult deploy config

The config file is auto-detected as `deploy.ts`, `deploy.js`, `deploy.config.ts` or `deploy.config.js` at the project root (override with `cata --config <path>`). It must default-export `defineConfig()`. Full reference: https://catapultjs.com/guide/api

## Before creating a config

If the user asks to create or configure a deployment and the repo/prompt does not provide enough information, ask for the missing deployment facts before writing files. Do not guess real production values such as SSH hostnames, deploy paths, domains, branches, or healthcheck URLs.

Use project inspection first:

- `package.json` scripts and dependencies identify the stack and package manager.
- Framework config files identify variants: `next.config.*` (`standalone` vs `export`), `nuxt.config.*`, `astro.config.*`, `vite.config.*`, `adonisrc.ts`, `nest-cli.json`.
- Existing `ecosystem.config.cjs` means `recipes/pm2` is likely wanted.
- Existing `.env.example`, `storage/`, `uploads/`, `public/`, or app-specific folders can suggest shared paths, but confirm anything destructive or production-specific.

Ask a compact set of questions for missing values:

1. Which environment and server? Need host name, SSH target (`user@host`), and absolute `deployPath`.
2. How should code reach the server? Use default SCP when uploading `source_path` is enough; choose `git` when the server can access the repository; choose `rsync` when rsync-based sync/delete behavior is preferred.
3. Which branch or source path should deploy?
4. Should PM2 be configured? If yes, confirm app name, start entry, port, and whether to create `ecosystem.config.cjs`.
5. Is there a healthcheck URL and any extra shared files or directories?

When the user answers, generate `deploy.ts` with the selected recipes and put `set(...)` calls before the recipe imports they configure.

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

## Code delivery

Catapult registers a default `deploy:update_code` task that uploads `source_path` via SCP. Recipes can override that task when a different delivery mechanism is needed. Pick one delivery mode:

| Recipe | Delivery | Use for |
| --- | --- | --- |
| default `deploy:update_code` | Uploads `source_path` via SCP | Simple local upload, static recipes that set `source_path` |
| `recipes/git` | Clones the repo on the server (bare mirror in `.catapult/repo`) | Server can reach the repo, build on server |
| `recipes/rsync` | Pushes a local directory into the release | Local builds, no repo access from server |
| `recipes/adonisjs_local` | Builds AdonisJS locally, uploads the artifact | AdonisJS without building on the server |
| `recipes/vitepress` | Builds locally, uploads the static output | VitePress static sites |
| custom `task('deploy:update_code', …)` | Whatever you implement | Anything else |

Avoid combining providers that override `deploy:update_code` (`git`, `rsync`, `adonisjs_local`, `vitepress`, custom) unless intentionally replacing task behavior.

## Picking recipes by stack

Inspect the project (`package.json`, lock file, config files) before choosing:

- **Next.js**: `nextjs` for standalone server builds on the server (pair with `git` or `rsync`); `nextjs_static` for static export built locally and uploaded from `./out/.` using default SCP unless `rsync` is imported.
- **Nuxt**: `nuxt` for server builds on the server (pair with `git` or `rsync`); `nuxt_static` for local static generation uploaded from `./.output/public/.` using default SCP unless `rsync` is imported.
- **Astro**: `astro` for standalone server builds on the server (pair with `git` or `rsync`); `astro_static` for static sites built locally and uploaded from `./dist/.` using default SCP unless `rsync` is imported.
- **TanStack Start**: `tanstack` for server builds on the server (pair with `git` or `rsync`); configure Vite with Nitro `node-server`.
- **NestJS**: `nestjs` wires standard install/build on the server (pair with `git` or `rsync`).
- **AdonisJS**: `adonisjs` (installs and builds on the server, exposes `ace:*` migration tasks; pair with `git` or `rsync`) or `adonisjs_local` (build locally, upload).
- **VitePress**: `vitepress` builds locally and uploads the static output.
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
2. Delivery mode is intentional: default SCP, or one overriding provider such as `git`, `rsync`, `adonisjs_local`, `vitepress`, or a custom `deploy:update_code`.
3. Recipe store options (`set(…)`) match the imported recipes.
4. Healthcheck URLs point to an endpoint reachable from the server itself.
5. Pin the package version in `package.json` (the API is still in beta).
6. Verify with `cata pipeline` (task order) and `cata list:tasks` (registered tasks), then `cata deploy:setup` before the first deploy.
