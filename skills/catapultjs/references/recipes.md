# Official Catapult recipes

Recipes are imported as side effects and register tasks into the pipeline automatically. Import order matters: `set()` calls that configure a recipe must appear **before** the recipe import.

Full docs: https://catapultjs.com/guide/recipes

## Choosing a recipe

| Recipe | Delivers `deploy:update_code`? | Use when |
| --- | --- | --- |
| `recipes/git` | Yes | Server can reach the repo; build runs on the server |
| `recipes/rsync` | Yes | Local build, push artifacts via rsync |
| `recipes/astro` | No (pair with `git` or `rsync`) | Astro, build on the server |
| `recipes/astro_static` | Uses default SCP; `rsync` optional | Static Astro site, build locally |
| `recipes/vitepress` | Yes | VitePress site, build locally, upload dist |
| `recipes/adonisjs_local` | Yes | AdonisJS, build locally, upload artifact |
| `recipes/adonisjs` | No (pair with `git` or `rsync`) | AdonisJS, build on the server |
| `recipes/nestjs` | No (pair with `git` or `rsync`) | NestJS, build on the server |
| `recipes/nextjs` | No (pair with `git` or `rsync`) | Next.js, build on the server |
| `recipes/nextjs_static` | Uses default SCP; `rsync` optional | Static Next.js export, build locally |
| `recipes/nuxt` | No (pair with `git` or `rsync`) | Nuxt, build on the server |
| `recipes/nuxt_static` | Uses default SCP; `rsync` optional | Static Nuxt site, generate locally |
| `recipes/directus` | No (pair with `git` or `rsync`) | Directus, migrations and schema snapshots |
| `recipes/caddy` | No | Caddy validation, reload, logs, status, and config upload |
| `recipes/pm2` | No | Process management (add to any stack) |
| `recipes/redis` | No | Redis cache flush (add to any stack) |
| `recipes/tanstack` | No (pair with `git` or `rsync`) | TanStack Start, build on the server |

---

## `recipes/git`

```typescript
import '@catapultjs/deploy/recipes/git'
```

Requires `branch` on each host. `repository` is auto-detected from `git remote get-url origin`.

| Task | Inserted | Description |
| --- | --- | --- |
| `git:check` | after `deploy:lock` | Verifies the branch exists on the remote |
| `git:update` | before `deploy:update_code` | Clones a bare mirror into `.catapult/repo`, or fetches it |
| `deploy:update_code` | — | Clones or resets the branch from the local mirror into the release |

No store keys.

---

## `recipes/rsync`

```typescript
import '@catapultjs/deploy/recipes/rsync'
```

Always uses `--delete`. Trailing slash on the source is added automatically.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:update_code` | — | Syncs a local directory into `releases/<release>/` via rsync |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `rsync_source_path` | `string` | `./` | Local source directory |
| `source_path` | `string` | — | Fallback if `rsync_source_path` is not set |
| `rsync_excludes` | `string[]` | `[]` | Patterns passed to `--exclude` |

```typescript
set('rsync_source_path', './dist')
set('rsync_excludes', ['.env'])
import '@catapultjs/deploy/recipes/rsync'
```

---

## `recipes/astro`

```typescript
import '@catapultjs/deploy/recipes/astro'
```

Remote build. Does not override `deploy:update_code` — pair with `git` or `rsync`.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release |
| `deploy:build` | after `deploy:shared` | Runs `astro build` on the server |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `astro_path` | `string` | `''` | Sub-path to the Astro app (monorepo) |
| `source_path` | `string` | `''` | Used as default for `astro_path` |

```typescript
set('astro_path', 'apps/web')
import '@catapultjs/deploy/recipes/astro'
```

Enable standalone server output in `astro.config.mjs`:

```typescript
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
})
```

---

## `recipes/astro_static`

```typescript
import '@catapultjs/deploy/recipes/astro_static'
```

Local build for static Astro sites. Sets `source_path` to `./dist/.` and runs `astro build --mode <astro_mode>` before the remote lock step.

Uses the built-in `deploy:update_code` task by default, which transfers `source_path` via SCP. Import `rsync` only if rsync-based transfers are preferred. Do not combine with `git`.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | before `deploy:lock` | Runs `astro build --mode <astro_mode>` locally |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `astro_mode` | `string \| Record<string, string>` | `'production'` | Build mode. String = same for all hosts; object = per host name |
| `source_path` | `string` | `'./dist/.'` | Local static output directory to transfer |

```typescript
// Per-host modes
set('astro_mode', { production: 'production', staging: 'staging' })
import '@catapultjs/deploy/recipes/astro_static'
```

Optional rsync transfer:

```typescript
import '@catapultjs/deploy/recipes/astro_static'
import '@catapultjs/deploy/recipes/rsync'
```

---

## `recipes/vitepress`

```typescript
import '@catapultjs/deploy/recipes/vitepress'
```

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | before `deploy:lock` | Runs `vitepress build <vitepress_path>` locally |
| `deploy:update_code` | — | Uploads `<vitepress_path>.vitepress/dist` to `releases/<release>` via SCP |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `vitepress_path` | `string` | `''` | Path passed to `vitepress build`; output read from `<path>.vitepress/dist` |
| `source_path` | `string` | `''` | Used as default for `vitepress_path` |

```typescript
set('vitepress_path', 'docs/')
import '@catapultjs/deploy/recipes/vitepress'
```

---

## `recipes/adonisjs`

```typescript
import '@catapultjs/deploy/recipes/adonisjs'
```

Remote build. Does not override `deploy:update_code` — pair with `git` or `rsync`.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release |
| `deploy:build` | after `deploy:shared` | Runs `node ace build`, copies `package.json` + lockfile into `build/`, creates `build/tmp` |
| `ace:migration:run` | before `deploy:publish` | Runs `node ace migration:run --force` |
| `ace:migration:rollback` | manual | Runs `node ace migration:rollback` |
| `ace:migration:status` | manual | Runs `node ace migration:status` |
| `ace:list:routes` | manual | Runs `node ace list:routes` |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `writable_dirs` | `string[]` | `['storage', 'logs', 'tmp']` | Created in `shared/` at setup |
| `shared_dirs` | `string[]` | `['storage', 'logs']` | Symlinked into each release |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |
| `adonisjs_path` | `string` | `''` | Sub-path to the app within the repo (monorepo) |

```typescript
set('adonisjs_path', 'apps/api')
set('shared_files', ['.env', '.env.production'])
import '@catapultjs/deploy/recipes/adonisjs'
```

---

## `recipes/adonisjs_local`

```typescript
import '@catapultjs/deploy/recipes/adonisjs_local'
```

Local build + artifact upload. Same `ace:*` tasks as `adonisjs`. Copies `package.json`, lockfile, and optionally `pnpm-workspace.yaml`, `.npmrc`, `ecosystem.config.cjs` into the local `build/` before uploading.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | before `deploy:lock` | Runs `node ace build` locally |
| `deploy:update_code` | — | Uploads local build output to `releases/<release>` via SCP |
| `deploy:install` | after `deploy:shared` | Installs prod dependencies in the release |
| `ace:migration:run` | before `deploy:publish` | Runs `node ace migration:run --force` |
| `ace:migration:rollback` | manual | Runs `node ace migration:rollback` |
| `ace:migration:status` | manual | Runs `node ace migration:status` |
| `ace:list:routes` | manual | Runs `node ace list:routes` |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `writable_dirs` | `string[]` | `['storage', 'logs', 'tmp']` | Created in `shared/` at setup |
| `shared_dirs` | `string[]` | `['storage', 'logs']` | Symlinked into each release |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |
| `adonisjs_path` | `string` | `''` | Sub-path to the app (monorepo) |
| `source_path` | `string` | `<adonisjs_path>/build/.` | Local build directory to upload |

---

## `recipes/nestjs`

```typescript
import '@catapultjs/deploy/recipes/nestjs'
```

Remote build for NestJS applications. Does not override `deploy:update_code` — pair with `git` or `rsync`.

Uses the default Node.js install/build tasks: install dependencies in `{{release_path}}`, then run the package manager build script.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release |
| `deploy:build` | after `deploy:install` | Runs the default `deploy:build` task (`<pm> run build`) |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |

```typescript
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nestjs'
import '@catapultjs/deploy/recipes/pm2'
```

PM2 entry:

```javascript
{
  name: 'nest',
  cwd: path.join(deployPath, 'current'),
  script: 'node',
  args: 'dist/main.js',
}
```

---

## `recipes/tanstack`

```typescript
import '@catapultjs/deploy/recipes/tanstack'
```

Remote build for TanStack Start applications. Does not override `deploy:update_code` — pair with `git` or `rsync`.

Uses the default Node.js install/build tasks: install dependencies in `{{release_path}}`, then run the package manager build script. `.env` is shared by default.

For Vite-based TanStack Start deployments on Node.js, use Nitro with the `node-server` preset and start the generated `.output/server/index.mjs` file.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release |
| `deploy:build` | after `deploy:install` | Runs the default `deploy:build` task (`<pm> run build`) |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), nitro({ preset: 'node-server' }), viteReact()],
})
```

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

PM2 environment should pass host/port explicitly:

```javascript
env: {
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  HOSTNAME: '0.0.0.0',
  NITRO_HOST: '0.0.0.0',
  PORT: 3000,
  NITRO_PORT: 3000,
}
```

Upstream hosting docs: https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nodejs--docker

---

## `recipes/nuxt`

```typescript
import '@catapultjs/deploy/recipes/nuxt'
```

Remote build. Does not override `deploy:update_code` — pair with `git` or `rsync`.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | — | Overrides the built-in build task, runs `nuxt build` |
| `nuxt:generate` | — | Runs `nuxt generate` (manual) |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |
| `nuxt_path` | `string` | `''` | Sub-path to the Nuxt app (monorepo) |
| `source_path` | `string` | `''` | Used as default for `nuxt_path` |

```typescript
set('nuxt_path', 'apps/web')
import '@catapultjs/deploy/recipes/nuxt'
```

PM2 entry:

```javascript
{
  name: 'nuxt',
  cwd: path.join(deployPath, 'current'),
  script: '.output/server/index.mjs',
}
```

For static Nuxt sites generated locally, use `recipes/nuxt_static`.

---

## `recipes/nuxt_static`

```typescript
import '@catapultjs/deploy/recipes/nuxt_static'
```

Local generation for static Nuxt sites. Sets `source_path` to `./.output/public/.` and runs `nuxt generate` before the remote lock step.

Uses the built-in `deploy:update_code` task by default, which transfers `source_path` via SCP. Import `rsync` only if rsync-based transfers are preferred. Do not combine with `git`.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | before `deploy:lock` | Runs `nuxt generate` locally |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `source_path` | `string` | `'./.output/public/.'` | Local generated output directory to transfer |

```typescript
import '@catapultjs/deploy/recipes/nuxt_static'
```

Optional rsync transfer:

```typescript
import '@catapultjs/deploy/recipes/nuxt_static'
import '@catapultjs/deploy/recipes/rsync'
```

---

## `recipes/nextjs`

```typescript
import '@catapultjs/deploy/recipes/nextjs'
```

Remote build. Does not override `deploy:update_code` — pair with `git` or `rsync`.

After `next build`, the recipe symlinks `public` and `.next/static` into `.next/standalone/` when the standalone output directory exists.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | after `deploy:shared` | Runs `next build` and prepares standalone output symlinks |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |
| `nextjs_path` | `string` | `''` | Sub-path to the Next.js app (monorepo) |
| `nextjs_out_path` | `string` | `'.next/standalone/'` | Standalone output path receiving `public` and `.next/static` symlinks |
| `source_path` | `string` | `''` | Used as default for `nextjs_path` |

```typescript
set('nextjs_path', 'apps/web')
import '@catapultjs/deploy/recipes/nextjs'
```

Enable standalone output in `next.config.*`:

```typescript
export default {
  output: 'standalone',
}
```

Next.js creates `.next/standalone/server.js` for standalone deployments. It does not copy `public` or `.next/static` into the standalone directory by default; this recipe links them into the standalone output after the build.

PM2 entry:

```javascript
{
  name: 'next',
  cwd: path.join(deployPath, 'current'),
  script: '.next/standalone/server.js',
}
```

Upstream output docs: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output

---

## `recipes/nextjs_static`

```typescript
import '@catapultjs/deploy/recipes/nextjs_static'
```

Local build for static Next.js export. Sets `source_path` to `./out/.` and runs `next build` before the remote lock step.

Uses the built-in `deploy:update_code` task by default, which transfers `source_path` via SCP. Import `rsync` only if rsync-based transfers are preferred.

| Task | Inserted | Description |
| --- | --- | --- |
| `deploy:build` | before `deploy:lock` | Runs `next build` locally |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `source_path` | `string` | `'./out/.'` | Local static export directory to transfer |

```typescript
import '@catapultjs/deploy/recipes/nextjs_static'
```

Optional rsync transfer:

```typescript
import '@catapultjs/deploy/recipes/nextjs_static'
import '@catapultjs/deploy/recipes/rsync'
```

Enable static export in `next.config.*`:

```typescript
export default {
  output: 'export',
}
```

---

## `recipes/directus`

```typescript
import '@catapultjs/deploy/recipes/directus'
```

DB migrations and schema snapshots. Does not override `deploy:update_code` — pair with `git` or `rsync`. All tasks are manual (not inserted automatically).

| Task | Inserted | Description |
| --- | --- | --- |
| `directus:database:migrate` | manual | Runs `directus database migrate:latest` |
| `directus:snapshot:create` | manual | Runs `directus schema snapshot <directus_snapshot_path>` |
| `directus:snapshot:apply` | manual | Runs `directus schema apply -y <directus_snapshot_path>` |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `writable_dirs` | `string[]` | `['uploads']` | Created in `shared/` at setup |
| `shared_dirs` | `string[]` | `['uploads']` | Symlinked into each release |
| `shared_files` | `string[]` | `['.env']` | Symlinked into each release |
| `directus_path` | `string` | `''` | Sub-path to the Directus app (monorepo) |
| `directus_snapshot_path` | `string` | `'./snapshot.yaml'` | Snapshot file path used by schema tasks |

```typescript
set('directus_path', 'apps/cms')
set('directus_snapshot_path', './database/snapshot.yaml')
import '@catapultjs/deploy/recipes/directus'
```

---

## `recipes/caddy`

```typescript
import '@catapultjs/deploy/recipes/caddy'
```

Manages an existing Caddy installation. Does not deliver application code and does not reload Caddy by default unless `caddy_reload_after_publish` is set before importing the recipe.

| Task | Inserted | Description |
| --- | --- | --- |
| `caddy:reload` | after `deploy:publish` when `caddy_reload_after_publish` is true | Validates and reloads Caddy |
| `caddy:validate` | manual | Runs `caddy validate` |
| `caddy:fmt` | manual | Formats the configured Caddyfile |
| `caddy:restart` | manual | Restarts the Caddy service |
| `caddy:status` | manual | Shows systemd status |
| `caddy:logs` | manual | Shows the last 100 journal log lines |
| `caddy:config:show` | manual | Displays the configured Caddyfile |
| `caddy:config:upload` | manual | Uploads a local Caddyfile, installs it, and validates it |

`onStatus` displays the Caddy version in `cata status`.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `caddy_config_path` | `string` | `'/etc/caddy/Caddyfile'` | Remote Caddyfile path |
| `caddy_local_config_path` | `string` | `'./Caddyfile'` | Local Caddyfile for upload |
| `caddy_service` | `string` | `'caddy'` | systemd service name |
| `caddy_use_sudo` | `boolean` | `true` | Prefix privileged commands with `sudo` |
| `caddy_validate_before_reload` | `boolean` | `true` | Validate before reload |
| `caddy_reload_after_publish` | `boolean` | `false` | Add reload after publish |

```typescript
set('caddy_reload_after_publish', true)
import '@catapultjs/deploy/recipes/caddy'
```

---

## `recipes/pm2`

```typescript
import '@catapultjs/deploy/recipes/pm2'
```

Requires an `ecosystem.config.cjs` at the release root. Use absolute paths inside that file resolving through `current/` to avoid stale release references after a new deploy.

| Task | Inserted | Description |
| --- | --- | --- |
| `pm2:startOrReload` | after `deploy:publish` | Starts or reloads via `startOrReload --update-env` |
| `pm2:save` | after `pm2:startOrReload` | Persists the PM2 process list |
| `pm2:start` | manual | Starts PM2 processes |
| `pm2:reload` | manual | Zero-downtime reload |
| `pm2:restart` | manual | Hard restart |
| `pm2:stop` | manual | Stops all processes |
| `pm2:delete` | manual | Deletes all processes from PM2 |
| `pm2:logs` | manual | Displays the last 50 lines of logs |
| `pm2:list` | manual | Lists PM2 processes |
| `pm2:show` | manual | Shows detailed info for each app in `ecosystem.config.cjs` |

No store keys. `onStatus` displays the PM2 version in `cata status`.

```bash
npx cata task pm2:reload
npx cata task pm2:logs --host staging
```

---

## `recipes/redis`

```typescript
import '@catapultjs/deploy/recipes/redis'
```

All tasks are manual (not inserted automatically).

| Task | Inserted | Description |
| --- | --- | --- |
| `redis:db:flush` | manual | Flushes the configured Redis DB(s) |
| `redis:db:flush_all` | manual | Runs `redis-cli FLUSHALL` |

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `redis_db` | `number \| number[]` | `1` | DB index(es) flushed by `redis:db:flush` |

```typescript
set('redis_db', [0, 1, 2])
import '@catapultjs/deploy/recipes/redis'

// Insert before publish:
before('deploy:publish', 'redis:db:flush')
```

---

## Monorepo pattern

Keep the transfer recipe (`git` or `rsync`) and override `deploy:install`/`deploy:build` paths via `set()`:

```typescript
import { defineConfig, set, before } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nuxt'
import '@catapultjs/deploy/recipes/directus'
import '@catapultjs/deploy/recipes/pm2'
import '@catapultjs/deploy/recipes/redis'

set('nuxt_path', 'apps/web')
set('directus_path', 'apps/cms')
set('directus_snapshot_path', './database/snapshot.yaml')
set('redis_db', 2)

before('deploy:publish', 'redis:db:flush')

export default defineConfig({
  hosts: [{ name: 'production', ssh: 'deploy@example.com', deployPath: '/home/deploy/acme', branch: 'main' }],
})
```

`deploy:install` (inserted by `nuxt`/`directus`) runs at the workspace root `{{release_path}}` by default — no override needed for standard monorepos.
