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

| Task            | Inserted               | Description                                                                         |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `pm2:ecosystem` | after `deploy:publish` | Symlinks `ecosystem.config.cjs` from the release into the base path                 |
| `pm2:start`     | after `pm2:ecosystem`  | Starts or reloads via `startOrReload --update-env`                                  |
| `pm2:save`      | after `pm2:start`      | Persists the PM2 process list                                                       |
| `pm2:reload`    | —                      | Zero-downtime reload (manual)                                                       |
| `pm2:restart`   | —                      | Hard restart (manual)                                                               |
| `pm2:stop`      | —                      | Stops all processes (manual)                                                        |
| `pm2:logs`      | —                      | Displays the last 50 lines of logs (manual)                                         |
| `pm2:list`      | —                      | Lists PM2 processes (manual)                                                        |
| `pm2:show`      | —                      | Shows detailed info for each app in ecosystem.config.cjs (manual)                  |

`pm2:ecosystem` creates a stable symlink at `{deploy_path}/ecosystem.config.cjs` pointing to the current release's config. This allows PM2 to reference a fixed path regardless of which release is active.

**Hooks**

`onStatus` — displays the PM2 version during `cata status`.

Manual tasks can be run from the terminal:

```bash
npx cata task pm2:reload
npx cata task pm2:logs --host staging
```
