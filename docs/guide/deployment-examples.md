---
description: Complete deployment pipeline examples for the official Catapult recipes.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# Deployment Examples

This page shows the complete pipeline for the most common official recipe combinations.

Browse the full [examples directory on GitHub](https://github.com/catapultjs/deploy/tree/main/examples).

The core package only provides the base pipeline. A recipe or custom task must implement `deploy:update_code`.

## `git` + `adonisjs` + `pm2`

The repository is mirrored in `.catapult/repo`, cloned into the new release, then built on the server.

```typescript
import { defineConfig } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/adonisjs'
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

```
deploy:lock
git:check            → verifies the branch exists on the remote
git:update           → clones or fetches the bare mirror into .catapult/repo
deploy:release
deploy:update_code   → clones the requested branch into releases/<release>
deploy:install       → installs dependencies in the release
deploy:shared        → symlinks shared dirs/files into the release
deploy:build         → node ace build in the app directory
ace:migration:run    → node ace migration:run --force
deploy:publish       → current → releases/<release>
pm2:startOrReload    → pm2 startOrReload ecosystem.config.cjs --update-env
pm2:save             → pm2 save
deploy:log_revision
deploy:healthcheck   → if configured
deploy:unlock
deploy:cleanup
```

---

## `rsync` + `adonisjs` + `pm2`

Local files are synced into the new release with rsync, then the app is installed and built on the server.

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'
import '@catapultjs/deploy/recipes/rsync'

set('rsync_source_path', './build')
set('rsync_excludes', ['.env'])

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

```
deploy:lock
deploy:release
deploy:update_code   → rsync rsync_source_path/ → releases/<release>/
deploy:install       → installs dependencies in the release
deploy:shared        → symlinks shared dirs/files into the release
deploy:build         → node ace build in the app directory
ace:migration:run    → node ace migration:run --force
deploy:publish       → current → releases/<release>
pm2:startOrReload    → pm2 startOrReload ecosystem.config.cjs --update-env
pm2:save             → pm2 save
deploy:log_revision
deploy:healthcheck   → if configured
deploy:unlock
deploy:cleanup
```

---

## `astro`

The Astro recipe builds locally, then uploads the generated directory to the release with SCP.

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/astro'

set('astro_mode', 'production')

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

```
deploy:build         → astro build --mode <astro_mode> on the local machine
deploy:lock
deploy:release
deploy:update_code   → upload(source_path) → releases/<release>
deploy:shared        → if configured
deploy:publish       → current → releases/<release>
deploy:log_revision
deploy:healthcheck   → if configured
deploy:unlock
deploy:cleanup
```

---

## Notes

- `git` requires `branch` on each host
- `rsync` always syncs the **contents** of the configured source directory into the release and uses `--delete`
- `astro` is intended for local-build workflows where the server only receives generated artifacts

---

## `astro` + `rsync`

This combination is useful when you want the Astro recipe to keep the local build step, but prefer rsync instead of SCP for artifact transfer.

Import order matters:

- import `astro` first so it registers `deploy:build`
- import `rsync` after it so `deploy:update_code` is overridden by rsync

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/astro'
import '@catapultjs/deploy/recipes/rsync'

set('source_path', './dist')
set('astro_mode', 'production')
set('rsync_excludes', ['.DS_Store'])

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

```
deploy:build         → astro build --mode <astro_mode> on the local machine
deploy:lock
deploy:release
deploy:update_code   → rsync source_path/ → releases/<release>/
deploy:shared        → if configured
deploy:publish       → current → releases/<release>
deploy:log_revision
deploy:healthcheck   → if configured
deploy:unlock
deploy:cleanup
```

In practice, `source_path` is reused by `rsync` when `rsync_source_path` is not set, so the same `./dist` output works for both recipes.
