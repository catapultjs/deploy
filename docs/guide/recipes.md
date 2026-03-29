# Recipes

Recipes add tasks to the pipeline automatically upon import.

## `recipes/adonisjs`

Adds the `adonisjs:build` and `adonisjs:migrate` tasks for an AdonisJS application.
Also sets the default values for `writable_dirs` and `shared_files`, and creates the corresponding directories and files on the server during `deploy:setup`.

```typescript
import '@catapultjs/deploy/recipes/adonisjs'
```

The recipe sets these defaults:

```typescript
set('writable_dirs', ['storage', 'logs', 'tmp'])
set('shared_files', ['.env'])
```

Override them in your `deploy.ts` before importing the recipe:

```typescript
import { set } from '@catapultjs/deploy'

set('writable_dirs', ['uploads', 'logs', 'tmp'])
set('shared_files', ['.env', '.env.production'])

import '@catapultjs/deploy/recipes/adonisjs'
```

## `recipes/pm2`

Adds the `pm2:start` task to start or reload processes via PM2.
The `ecosystem.config.cjs` file must be present in the project.

```typescript
import '@catapultjs/deploy/recipes/pm2'
```

### PM2 tasks

| Task          | Description                                          |
| ------------- | ---------------------------------------------------- |
| `pm2:start`   | Starts or reloads via `startOrReload` (used in pipeline) |
| `pm2:reload`  | Zero-downtime reload (graceful)                      |
| `pm2:restart` | Hard restart                                         |
| `pm2:stop`    | Stops applications                                   |
| `pm2:logs`    | Displays the last 50 lines of PM2 logs               |
| `pm2:list`    | Lists PM2 processes                                  |

`pm2:start` is automatically inserted after `deploy:publish` in the pipeline. It uses `startOrReload` internally, which handles both first deployments (start) and subsequent ones (zero-downtime reload).

`pm2:reload` and `pm2:restart` are available as manual tasks:

```bash
cata task pm2:reload
cata task pm2:restart --host staging
cata task pm2:logs
cata task pm2:list --host staging
```

## `recipes/rsync`

Replaces the default transfer mode (git) with rsync.

```typescript
import { set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/rsync'

set('rsync_excludes', ['.git', 'node_modules', '.env', 'storage', 'tmp', 'logs'])
```

> With this recipe, `branch` is no longer required on hosts.

### Upload: git vs rsync

By default, `deploy:update_code` performs a `git clone` on the server:

```typescript
hosts: [
  {
    name: 'staging',
    ssh: 'deploy@staging.example.com',
    deployPath: '/home/deploy/staging/myapp',
    branch: 'develop', // required in git mode
  },
]
```

The `repository` is auto-detected from `git remote get-url origin` if not specified.

To use rsync instead, import the `recipes/rsync` recipe (see above).
