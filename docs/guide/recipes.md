---
description: Drop-in Catapult recipes for Node.js, Bun, AdonisJS, PM2, git and rsync.
---

# Recipes

:::warning Alpha
`@catapultjs/deploy` is currently in alpha. Its API may change between minor releases until it reaches a stable version. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

Recipes are importable modules that register tasks and insert them into the pipeline automatically.

## `recipes/git`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/git.ts)

```typescript
import '@catapultjs/deploy/recipes/git'
```

**Tasks**

| Task                  | Inserted             | Description                                        |
| --------------------- | -------------------- | -------------------------------------------------- |
| `git:check`           | after `deploy:lock`  | Verifies the branch exists on the remote           |
| `deploy:update_code`  | —                    | Overrides the built-in task to clone via git       |
| `deploy:log_revision` | —                    | Overrides the built-in task to log branch + commit |

`branch` is required on each host. The `repository` is auto-detected from `git remote get-url origin` if not set in `defineConfig`.

---

## `recipes/nodejs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nodejs.ts)

```typescript
import '@catapultjs/deploy/recipes/nodejs'
```

Adds Node.js install and build steps to the pipeline. The package manager is configured via `packageManager` in `defineConfig` (defaults to `npm`).

**Tasks**

| Task                       | Inserted                    | Description                                         |
| -------------------------- | --------------------------- | --------------------------------------------------- |
| `nodejs:install`           | after `deploy:shared`       | Installs dependencies (frozen lockfile)             |
| `nodejs:install:production`| —                           | Installs production-only dependencies (manual)      |
| `nodejs:build`             | after `nodejs:install`      | Runs `<pm> run build`                               |

```typescript
import '@catapultjs/deploy/recipes/nodejs'

export default defineConfig({
  packageManager: 'pnpm',
  // ...
})
```

---

## `recipes/bun`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/bun.ts)

```typescript
import '@catapultjs/deploy/recipes/bun'
```

Adds Bun install and build steps to the pipeline.

**Tasks**

| Task                      | Inserted                 | Description                                         |
| ------------------------- | ------------------------ | --------------------------------------------------- |
| `bun:install`             | after `deploy:shared`    | Installs dependencies (frozen lockfile)             |
| `bun:install:production`  | —                        | Installs production-only dependencies (manual)      |
| `bun:build`               | after `bun:install`      | Runs `bun run build`                                |

```typescript
import '@catapultjs/deploy/recipes/bun'

export default defineConfig({
  packageManager: 'bun',
  // ...
})
```

---

## `recipes/rsync`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/rsync.ts)

```typescript
import '@catapultjs/deploy/recipes/rsync'
```

**Tasks**

| Task                 | Inserted | Description                                              |
| -------------------- | -------- | -------------------------------------------------------- |
| `deploy:update_code` | —        | Overrides the built-in task to transfer files via rsync  |

**Configuration**

| Key                  | Type       | Default | Description                              |
| -------------------- | ---------- | ------- | ---------------------------------------- |
| `rsync_source_path`  | `string`   | `./`    | Local source directory                   |
| `rsync_excludes`     | `string[]` | `[]`    | Patterns passed to `--exclude`           |

```typescript
import { set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/rsync'

set('rsync_source_path', './dist/')
set('rsync_excludes', ['.git', 'node_modules', '.env'])
```

---

## `recipes/adonisjs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/adonisjs.ts)

```typescript
import '@catapultjs/deploy/recipes/adonisjs'
```

**Tasks**

| Task                 | Inserted                    | Description                          |
| -------------------- | --------------------------- | ------------------------------------ |
| `adonisjs:install`   | after `deploy:shared`       | Installs dependencies                |
| `adonisjs:build`     | after `adonisjs:install`    | Runs `node ace build`                |
| `adonisjs:migrate`   | after `adonisjs:build`      | Runs `node ace migration:run`        |

**Configuration**

| Key               | Type       | Default                      | Description                                                       |
| ----------------- | ---------- | ---------------------------- | ----------------------------------------------------------------- |
| `writable_dirs`   | `string[]` | `['storage', 'logs', 'tmp']` | Directories created in `shared/` during `cata deploy:setup`      |
| `shared_dirs`     | `string[]` | `['storage', 'logs']`        | Directories symlinked from `shared/` into each release            |
| `shared_files`    | `string[]` | `['.env']`                   | Files symlinked from `shared/` into each release                  |
| `adonisjs_path`   | `string`   | `''`                         | Sub-path to the AdonisJS app within the repository                |

```typescript
import { set } from '@catapultjs/deploy'

set('shared_files', ['.env', '.env.production'])

import '@catapultjs/deploy/recipes/adonisjs'
```

---

## `recipes/pm2`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/pm2.ts)

```typescript
import '@catapultjs/deploy/recipes/pm2'
```

Requires an `ecosystem.config.cjs` file at the root of the project.

**Tasks**

| Task              | Inserted                  | Description                                                                          |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `pm2:ecosystem`   | after `deploy:publish`    | Symlinks `ecosystem.config.cjs` from the release into the base path                 |
| `pm2:start`       | after `pm2:ecosystem`     | Starts or reloads via `startOrReload --update-env`                                   |
| `pm2:save`        | after `pm2:start`         | Persists the PM2 process list                                                        |
| `pm2:reload`      | —                         | Zero-downtime reload (manual)                                                        |
| `pm2:restart`     | —                         | Hard restart (manual)                                                                |
| `pm2:stop`        | —                         | Stops all processes (manual)                                                         |
| `pm2:logs`        | —                         | Displays the last 50 lines of logs (manual)                                          |
| `pm2:list`        | —                         | Lists PM2 processes (manual)                                                         |
| `pm2:show`        | —                         | Shows detailed info for each app in ecosystem.config.cjs (manual)                   |

`pm2:ecosystem` creates a stable symlink at `{deploy_path}/ecosystem.config.cjs` pointing to the current release's config. This allows PM2 to reference a fixed path regardless of which release is active.

**Hooks**

`onStatus` — displays the PM2 version during `cata status`.

Manual tasks can be run from the terminal:

```bash
npx cata task pm2:reload
npx cata task pm2:logs --host staging
```
