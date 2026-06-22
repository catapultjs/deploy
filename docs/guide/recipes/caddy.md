---
description: Validate, reload, and inspect Caddy from Catapult deployments.
---

# `recipes/caddy`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/caddy.ts)

```typescript
import '@catapultjs/deploy/recipes/caddy'
```

This recipe manages an existing Caddy installation on the target server. It does not build or
transfer application code, so combine it with app recipes such as `nextjs`, `nestjs`, `adonisjs`,
`pm2`, `git`, or `rsync`.

By default the recipe does not reload Caddy during deployments. Enable it explicitly with
`caddy_reload_after_publish`.

**Tasks**

| Task                  | Inserted                                     | Description                                           |
| --------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `caddy:reload`        | after `deploy:publish` when explicitly enabled | Validates and reloads Caddy with the configured file |
| `caddy:validate`      | —                                            | Runs `caddy validate`                                 |
| `caddy:fmt`           | —                                            | Formats the configured Caddyfile                      |
| `caddy:restart`       | —                                            | Restarts the Caddy service                            |
| `caddy:status`        | —                                            | Shows `systemctl status` for the Caddy service        |
| `caddy:logs`          | —                                            | Shows the last 100 journal log lines                  |
| `caddy:config:show`   | —                                            | Displays the configured Caddyfile                     |
| `caddy:config:upload` | —                                            | Uploads a local Caddyfile, installs it, and validates |

**Hooks**

`onStatus` — displays the Caddy version during `cata status`.

**Configuration**

| Key                            | Type      | Default                  | Description                                              |
| ------------------------------ | --------- | ------------------------ | -------------------------------------------------------- |
| `caddy_config_path`            | `string`  | `'/etc/caddy/Caddyfile'` | Remote Caddyfile path                                    |
| `caddy_local_config_path`      | `string`  | `'./Caddyfile'`          | Local Caddyfile used by `caddy:config:upload`            |
| `caddy_service`                | `string`  | `'caddy'`                | systemd service name                                     |
| `caddy_use_sudo`               | `boolean` | `true`                   | Prefixes privileged commands with `sudo`                 |
| `caddy_validate_before_reload` | `boolean` | `true`                   | Runs validation before `caddy:reload`                    |
| `caddy_reload_after_publish`   | `boolean` | `false`                  | Inserts `caddy:reload` after `deploy:publish`            |

Example:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'

set('caddy_reload_after_publish', true)
set('caddy_config_path', '/etc/caddy/Caddyfile')

import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nextjs'
import '@catapultjs/deploy/recipes/pm2'
import '@catapultjs/deploy/recipes/caddy'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/var/www/app',
      branch: 'main',
    },
  ],
})
```

Manual tasks:

```bash
npx cata task caddy:validate
npx cata task caddy:reload --host production
npx cata task caddy:logs --host production
```

Upload a Caddyfile explicitly:

```typescript
set('caddy_local_config_path', './deploy/Caddyfile')
```

```bash
npx cata task caddy:config:upload --host production
npx cata task caddy:reload --host production
```
