# Recipes

Recipes add tasks to the pipeline automatically upon import.

## `recipes/adonisjs`

Adds the `adonisjs:shared`, `adonisjs:build`, and `adonisjs:migrate` tasks for an AdonisJS application.
Also creates shared directories (`storage`, `logs`, `tmp`, `.env`) during `deploy:setup`.

```typescript
import '@jrmc/catapult/recipes/adonisjs'
```

## `recipes/pm2`

Adds the `pm2:start` task to start or reload processes via PM2.
The `ecosystem.config.cjs` file must be present in the project.

```typescript
import '@jrmc/catapult/recipes/pm2'
```

### PM2 tasks

| Task          | Description                            |
| ------------- | -------------------------------------- |
| `pm2:logs`    | Displays the last 50 lines of PM2 logs |
| `pm2:list`    | Lists PM2 processes                    |
| `pm2:stop`    | Stops applications                     |
| `pm2:restart` | Restarts applications                  |

```bash
cata task pm2:logs
cata task pm2:list --host staging
```

## `recipes/rsync`

Replaces the default transfer mode (git) with rsync.

```typescript
import { set } from '@jrmc/catapult'
import '@jrmc/catapult/recipes/rsync'

set('rsync_excludes', ['.git', 'node_modules', '.env', 'storage', 'tmp', 'logs'])
```

> With this recipe, `branch` is no longer required on hosts.

### Upload: git vs rsync

By default, `deploy:upload` performs a `git clone` on the server:

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
