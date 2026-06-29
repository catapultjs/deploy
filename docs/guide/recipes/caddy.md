---
description: Validate, reload, and upload Caddy configuration from Catapult deployments.
---

# `recipes/caddy`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/caddy.ts)

```typescript
import '@catapultjs/deploy/recipes/caddy'
```

This recipe manages Caddy configuration on the target server. It does not build or transfer
application code, so combine it with app recipes such as `nextjs`, `nestjs`, `adonisjs`, `pm2`,
`git`, or `rsync`.

Service management is intentionally separate. If Caddy is managed by systemd, combine this recipe
with [`recipes/systemd`](./systemd) and set `systemd_service` to `caddy`.

By default the recipe does not reload Caddy during deployments. Enable it explicitly with
`caddy_reload_after_publish`.

> [!WARNING]
> Caddy must be able to traverse every parent directory of the configured web root and read the
> published files. Deploying under a private home directory such as `/home/deploy/...` may require
> extra permissions or ACLs. Prefer a web root under `/var/www/<app>` or `/srv/www/<app>` for static
> sites. On the server, use `namei -l /path/to/current/index.html` to inspect which directory blocks
> access.

**Tasks**

| Task                  | Inserted                                       | Description                                           |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `caddy:reload`        | after `deploy:publish` when explicitly enabled | Validates and reloads Caddy with the configured file |
| `caddy:validate`      | —                                              | Runs `caddy validate`                                 |
| `caddy:fmt`           | —                                              | Formats the configured Caddyfile                      |
| `caddy:config:show`   | —                                              | Displays the configured Caddyfile                     |
| `caddy:config:upload` | —                                              | Uploads a local Caddyfile, installs it, and validates |

**Hooks**

`onStatus` — displays the Caddy version during `cata status`.

**Configuration**

| Key                            | Type      | Default                  | Description                                              |
| ------------------------------ | --------- | ------------------------ | -------------------------------------------------------- |
| `caddy_config_path`            | `string`  | `'/etc/caddy/Caddyfile'` | Remote Caddyfile path                                    |
| `caddy_local_config_path`      | `string`  | `'./Caddyfile'`          | Local Caddyfile used by `caddy:config:upload`            |
| `caddy_use_sudo`               | `boolean` | `true`                   | Prefixes privileged commands with `sudo`                 |
| `caddy_validate_before_reload` | `boolean` | `true`                   | Runs validation before `caddy:reload`                    |
| `caddy_reload_after_publish`   | `boolean` | `false`                  | Inserts `caddy:reload` after `deploy:publish`            |

Example:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'

set('caddy_reload_after_publish', true)
set('caddy_config_path', '/etc/caddy/Caddyfile')
set('systemd_service', 'caddy')

import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nextjs'
import '@catapultjs/deploy/recipes/pm2'
import '@catapultjs/deploy/recipes/caddy'
import '@catapultjs/deploy/recipes/systemd'

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
npx cata task systemd:logs --host production
```

Upload a Caddyfile explicitly:

```typescript
set('caddy_local_config_path', './deploy/Caddyfile')
```

```bash
npx cata task caddy:config:upload --host production
npx cata task caddy:reload --host production
```
