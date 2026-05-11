---
description: Manage processes with PM2 using the Catapult pm2 recipe.
---

# `recipes/pm2`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/pm2.ts)

```typescript
import '@catapultjs/deploy/recipes/pm2'
```

Requires an `ecosystem.config.cjs` file at the root of the project.

**Tasks**

| Task                | Inserted                  | Description                                                       |
| ------------------- | ------------------------- | ----------------------------------------------------------------- |
| `pm2:startOrReload` | after `deploy:publish`    | Starts or reloads PM2 processes via `startOrReload --update-env`  |
| `pm2:save`          | after `pm2:startOrReload` | Persists the PM2 process list                                     |
| `pm2:start`         | —                         | Starts PM2 processes (manual)                                     |
| `pm2:reload`        | —                         | Zero-downtime reload (manual)                                     |
| `pm2:restart`       | —                         | Hard restart (manual)                                             |
| `pm2:stop`          | —                         | Stops all processes (manual)                                      |
| `pm2:delete`        | —                         | Deletes all processes from PM2 (manual)                           |
| `pm2:logs`          | —                         | Displays the last 50 lines of logs (manual)                       |
| `pm2:list`          | —                         | Lists PM2 processes (manual)                                      |
| `pm2:show`          | —                         | Shows detailed info for each app in ecosystem.config.cjs (manual) |

`ecosystem.config.cjs` must be present at the root of each release, because PM2 reads it from `{{release_path}}`.

Inside that file, prefer absolute paths that resolve through `current` instead of paths tied to a specific release directory. This avoids keeping references to an old release after a new deployment.

Example:

```js
const path = require('path')
const root = path.resolve(__dirname, '../', 'current')

module.exports = {
  apps: [
    {
      name: 'admin',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      cwd: root,
      script: 'pnpm',
      args: 'run start',
      max_memory_restart: '1G',
    },
  ],
}
```

Stop, reload, restart and delete tasks use `{{current_path}}` so they always target the active release.

**Hooks**

`onStatus` — displays the PM2 version during `cata status`.

Manual tasks can be run from the terminal:

```bash
npx cata task pm2:reload
npx cata task pm2:logs --host staging
```
