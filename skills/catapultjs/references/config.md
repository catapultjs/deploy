# Writing a Catapult deploy config

Config files are auto-detected at the project root (override with `cata <command> --config <path>`):

- TypeScript/JavaScript: `deploy.ts`, `deploy.config.ts`, `deploy.js`, `deploy.config.js`
- JSON: `deploy.config.json`, `deploy.json`

TypeScript and JavaScript must default-export `defineConfig()`. JSON is validated as a strict declarative document. Full references: https://catapultjs.com/guide/api and https://catapultjs.com/guide/json-configuration

## Choosing a format

Use JSON for a data-only deployment made from built-in recipes, serializable store values, declarative task steps and direct pipeline controls. Prefer `deploy.config.json`, include the public schema URL, and set `version` to `1`.

Use TypeScript or JavaScript when the deployment needs callbacks/hooks, external or project-local recipes, dynamic `bin()` calls inside custom tasks, conditions such as `inPipeline()`, or custom task code with branching, loops, API calls or arbitrary async behavior. Static per-host `bin` overrides are supported in JSON. Do not try to encode executable behavior as JSON strings.

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

When the user answers, generate the requested format. For TypeScript/JavaScript, put `set(...)` calls before the recipe imports they configure. For JSON, put those values under `store` and recipe names under `recipes`.

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

## JSON configuration

Use strict JSON: double-quoted keys and strings, with no comments or trailing commas. The schema rejects unknown properties and validates the whole document before Catapult connects to a host.

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "recipes": ["git"],
  "config": {
    "keepReleases": 2,
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@example.com",
        "deployPath": "/home/deploy/myapp",
        "branch": "main"
      }
    ]
  },
  "store": {
    "shared_files": [".env"],
    "shared_dirs": ["storage", "logs"]
  },
  "tasks": {
    "app:build": {
      "description": "Install dependencies and build the application",
      "steps": [{ "cd": "{{release_path}}" }, { "run": "npm ci" }, { "run": "npm run build" }]
    }
  },
  "after": {
    "deploy:shared": "app:build"
  }
}
```

Top-level contract:

| Field      | Rule                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `$schema`  | Recommended: `https://catapultjs.com/schema/deploy.schema.json`                                      |
| `version`  | Required and exactly `1`                                                                            |
| `recipes`  | Optional closed list of built-in recipe names                                                       |
| `config`   | Required serializable `Config` values, excluding function-valued `hooks`                            |
| `store`    | Optional typed values for documented core and built-in recipe keys, equivalent to `set(key, value)` |
| `tasks`    | Optional object of declarative task definitions                                                     |
| `pipeline` | Optional complete task array, equivalent to `setPipeline()`                                         |
| `remove`   | Optional task array, equivalent to repeated `remove()` calls                                        |
| `before`   | Optional target-to-task mapping, equivalent to `before()`                                           |
| `after`    | Optional target-to-task mapping, equivalent to `after()`                                            |

Built-in recipe names accepted by JSON: `adonisjs`, `adonisjs_local`, `astro`, `astro_static`, `caddy`, `directus`, `git`, `nestjs`, `nextjs`, `nextjs_static`, `nuxt`, `nuxt_static`, `pm2`, `redis`, `rsync`, `systemd`, `tanstack`, `vitepress`. Do not use module paths such as `recipes/git`.

The schema validates known `store` key types and rejects unknown keys. Use TypeScript or JavaScript when a custom recipe needs its own store contract.

`config` accepts `hosts`, `keepReleases`, `repository`, `packageManager` and `verbose`. Host data accepts `name`, `ssh`, `deployPath`, `branch`, `healthcheck` and static `bin` path overrides. Host names must be unique. Built-in recipes can resolve `hosts[].bin`; declarative custom task steps cannot invoke the dynamic `bin()` helper.

A task is either an array of steps or `{ "description": "...", "steps": [...] }`. Supported steps:

- `{ "cd": "..." }` and `{ "run": "..." }` execute remotely.
- `{ "local": { "command": "...", "cwd": "..." } }` executes locally; `cwd` is optional.
- `{ "upload": { "local": "...", "remote": "..." } }` uploads with SCP.
- `{ "download": { "remote": "...", "local": "..." } }` downloads with SCP.

Local, upload and download steps flush the current remote command batch. Repeat `{ "cd": "..." }` before later remote `{ "run": "..." }` steps when a task mixes remote commands with local or transfer steps.

Remote commands and paths support Catapult placeholders such as `{{release_path}}`, `{{current_path}}` and `{{shared_path}}`. Declaring a task registers it but does not insert it into the deploy pipeline.

Pipeline controls are applied after recipes and tasks are registered, in a fixed order independent of top-level JSON property order:

1. `pipeline` replaces the complete task sequence when present.
2. `remove` removes each listed task.
3. `before` inserts a task or ordered task array before each target.
4. `after` inserts a task or ordered task array after each target.

```json
{
  "pipeline": ["deploy:lock", "deploy:release", "deploy:publish", "deploy:unlock"],
  "remove": ["deploy:release"],
  "before": { "deploy:publish": "app:verify" },
  "after": { "deploy:lock": ["app:install", "app:build"] }
}
```

Every pipeline and placement task must be registered. Each `before`/`after` target must exist when placement is applied, and the final pipeline must contain at least one task. A task can be placed only once across `before` and `after`; it cannot also be a placement target or appear under `remove`. Use an array under one target for an ordered task sequence. When `pipeline` is present it replaces recipe insertions too; recipes still register their tasks, but the array must describe the complete intended sequence.

Catapult already unlocks failed deployments automatically; do not invent a `deploy:failed` hook mapping. `ace:migration:run` only exists when `adonisjs` is listed in `recipes`, so import that recipe before trying to remove the migration task.

## Code delivery

Catapult registers a default `deploy:update_code` task that uploads `source_path` via SCP. Recipes can override that task when a different delivery mechanism is needed. Pick one delivery mode:

| Recipe                                 | Delivery                                                        | Use for                                                    |
| -------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| default `deploy:update_code`           | Uploads `source_path` via SCP                                   | Simple local upload, static recipes that set `source_path` |
| `recipes/git`                          | Clones the repo on the server (bare mirror in `.catapult/repo`) | Server can reach the repo, build on server                 |
| `recipes/rsync`                        | Pushes a local directory into the release                       | Local builds, no repo access from server                   |
| `recipes/adonisjs_local`               | Builds AdonisJS locally, uploads the artifact                   | AdonisJS without building on the server                    |
| `recipes/vitepress`                    | Builds locally, uploads the static output                       | VitePress static sites                                     |
| custom `task('deploy:update_code', …)` | Whatever you implement                                          | Anything else                                              |

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

Recipes register their tasks at import time. In TypeScript/JavaScript, imports must appear before or inside the config file, never lazily. In JSON, list built-in names under `recipes`; external recipes require TypeScript or JavaScript.

## Config options

| Option            | Type             | Notes                                                                           |
| ----------------- | ---------------- | ------------------------------------------------------------------------------- |
| `hosts`           | `Host[]`         | Required                                                                        |
| `keepReleases?`   | `number`         | Default `5`                                                                     |
| `repository?`     | `string`         | Auto-detected from git origin                                                   |
| `packageManager?` | `PackageManager` | Auto-detected from lock file                                                    |
| `hooks?`          | `Hooks`          | TypeScript/JavaScript only; see below                                           |
| `verbose?`        | `Verbose`        | From `@catapultjs/deploy/enums`: `SILENT`, `NORMAL`, `TRACE` (default), `DEBUG` |

## Host options

| Option         | Type                           | Notes                                                                                                                                                                                                                            |
| -------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `string`                       | Identifier used by `--host` / `hosts:` selectors                                                                                                                                                                                 |
| `ssh`          | `string \| SshConfig`          | `'user@host'` or `{ user, host, port? }`                                                                                                                                                                                         |
| `deployPath`   | `string`                       | Absolute path on the server                                                                                                                                                                                                      |
| `branch?`      | `string \| { name, ask }`      | `ask: true` prompts at deploy time (CLI only)                                                                                                                                                                                    |
| `healthcheck?` | `{ url?, retries?, delayMs? }` | Curl check after publish; the `deploy:healthcheck` task is removed automatically when no host defines a `url`                                                                                                                    |
| `bin?`         | `Record<string, string>`       | Supported in all formats. Per-host binary paths, e.g. `{ node: '/home/deploy/.nvm/versions/node/v24.0.0/bin/node' }`. Built-in recipes resolve these paths; calling `bin()` inside a custom task requires TypeScript/JavaScript. |

Multiple environments are just multiple hosts (`production`, `staging`); target one with `cata deploy -H staging`.

## Lifecycle hooks

TypeScript/JavaScript only. All optional, all `(ctx: { host?, hosts?, error? }) => Promise<void>`:

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
after('deploy:install', 'deploy:build') // pm run build
after('deploy:build', 'deploy:test') // pm run test
```

Pipeline functions: `after(existing, task)`, `before(existing, task)`, `remove(name)`, `inPipeline(name)` to place a task relative to optional steps, `setPipeline([…])` to replace the whole sequence. Insertion deduplicates: re-adding a task moves it, the last position wins.

```typescript
import { set, after, inPipeline, remove, task, run, cd } from '@catapultjs/deploy'

set('writable_dirs', ['logs', 'tmp/uploads']) // created under shared/ at setup
set('shared_files', ['.env']) // touched under shared/ at setup
set('rsync_source_path', './dist') // rsync recipe option

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

1. TypeScript/JavaScript default-exports `defineConfig()`; JSON uses strict syntax, the public `$schema` URL and `version: 1`.
2. Delivery mode is intentional: default SCP, or one overriding provider such as `git`, `rsync`, `adonisjs_local`, `vitepress`, or a custom `deploy:update_code`.
3. Recipe store options (`set(…)`) match the imported recipes.
4. Healthcheck URLs point to an endpoint reachable from the server itself.
5. Pin the package version in `package.json` (the API is still in beta).
6. Verify with `cata pipeline` (task order) and `cata list:tasks` (registered tasks), then `cata deploy:setup` before the first deploy.
