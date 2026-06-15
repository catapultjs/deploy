---
description: Deploy a monorepo with Catapult by overriding install and build tasks at the workspace root.
---

# Monorepo

A monorepo usually needs two things:

1. install dependencies at the **workspace root**
2. build a specific app from that workspace

The official recipes work well for single-app repositories. In a monorepo, the usual approach is to keep the transfer recipe (`git` or `rsync`) and override `deploy:install` / `deploy:build` so they run in the right directories.

## Monorepo with Directus and Nuxt using `git`

This example deploys a monorepo that contains a Directus app in `apps/cms` and a Nuxt app in `apps/web`.

`git` clones the whole repository into the release, dependencies are installed once at the workspace root, `nuxt` builds the frontend from its app directory, `directus` runs its schema tasks from its own app directory, and Redis cache is flushed before publish.

```typescript
import { defineConfig, task, cd, run, set, before } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/directus'
import '@catapultjs/deploy/recipes/nuxt'
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/redis'
import '@catapultjs/deploy/recipes/pm2'

set('directus_path', 'apps/cms')
set('directus_snapshot_path', './database/snapshot.yaml')
set('nuxt_path', 'apps/web')
set('redis_db', 2)

before('deploy:publish', 'redis:db:flush')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/acme',
      branch: 'main',
    },
  ],
})
```

In this setup:

- `deploy:update_code` comes from `git`
- `deploy:install` is inserted by `nuxt` and `directus`, and its default implementation already runs at the monorepo root (`{{release_path}}`)
- `deploy:build` comes from `nuxt` and runs in `apps/web`
- `directus:database:migrate` comes from `directus` and runs in `apps/cms` before publish
- `redis:db:flush` is added manually before `deploy:publish` to clear Nuxt route cache in Redis database 2

Generated pipeline:

```text
deploy:lock
git:check
deploy:release
git:update
deploy:update_code
deploy:install
deploy:shared
deploy:build
directus:database:migrate
directus:snapshot:apply
redis:db:flush
deploy:publish
pm2:startOrReload
pm2:save
deploy:log_revision
deploy:unlock
deploy:cleanup
```


## Tips

- Keep the transfer step simple: `git` for full-repository deploys, `rsync` or `astro` for artifact deploys
- Override `deploy:install` only when the default install step is not enough, for example if the monorepo needs a custom install command
- Override `deploy:build` when the app build command differs from a single-package repository
- Use `shared_dirs` and `shared_files` exactly the same way as in a non-monorepo project
