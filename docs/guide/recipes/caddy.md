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

The recipe does not insert tasks into the deployment pipeline. To reload Caddy after publishing,
add `after('deploy:publish', 'caddy:reload')` explicitly to your deploy configuration.

> [!WARNING]
> Caddy must be able to traverse every parent directory of the configured web root and read the
> published files. Deploying under a private home directory such as `/home/deploy/...` may require
> extra permissions or ACLs. Prefer a web root under `/var/www/<app>` or `/srv/www/<app>` for static
> sites. On the server, use `namei -l /path/to/current/index.html` to inspect which directory blocks
> access.

**Tasks**

| Task                  | Inserted | Description                                           |
| --------------------- | -------- | ----------------------------------------------------- |
| `caddy:reload`        | —        | Validates and reloads Caddy with the configured file  |
| `caddy:validate`      | —        | Runs `caddy validate`                                 |
| `caddy:fmt`           | —        | Formats the configured Caddyfile                      |
| `caddy:config:show`   | —        | Displays the configured Caddyfile                     |
| `caddy:config:upload` | —        | Uploads a local Caddyfile, installs it, and validates |

**Hooks**

`onStatus` — displays the Caddy version during `cata status`.

**Configuration**

| Key                            | Type      | Default                  | Description                                                                |
| ------------------------------ | --------- | ------------------------ | -------------------------------------------------------------------------- |
| `caddy_config_path`            | `string`  | `'/etc/caddy/Caddyfile'` | Remote Caddyfile path                                                      |
| `caddy_local_config_path`      | `string`  | `'./Caddyfile'`          | Local Caddyfile used by `caddy:config:upload`                              |
| `caddy_upload_path`            | `string`  | `caddy_config_path`      | Remote destination for uploads; its parent directory is created if missing |
| `caddy_use_sudo`               | `boolean` | `true`                   | Prefixes privileged commands with `sudo`                                   |
| `caddy_validate_before_reload` | `boolean` | `true`                   | Runs validation before `caddy:reload`                                      |

Example:

```typescript
import { defineConfig, set, after } from '@catapultjs/deploy'

import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nextjs'
import '@catapultjs/deploy/recipes/pm2'
import '@catapultjs/deploy/recipes/systemd'
import '@catapultjs/deploy/recipes/caddy'

set('caddy_config_path', '/etc/caddy/Caddyfile')
set('systemd_service', 'caddy')

after('deploy:publish', 'caddy:reload')

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

Static imports are sufficient. In a JSON deploy configuration, use the equivalent hook:

```json
{
  "after": {
    "deploy:publish": "caddy:reload"
  }
}
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

Upload a site file imported by the main Caddyfile:

```typescript
set('caddy_local_config_path', './Caddyfile')
set('caddy_upload_path', '/etc/caddy/sites/example.com.caddy')
set('caddy_config_path', '/etc/caddy/Caddyfile')
```

The main `/etc/caddy/Caddyfile` must already include the site files using
[`import`](https://caddyserver.com/docs/caddyfile/directives/import):

```caddyfile
import sites/*.caddy
```

`caddy:config:upload` creates the destination directory if needed, installs only the site file,
then validates the main configuration with its imports. Validation runs after installation;
a failure leaves the uploaded file on disk and fails the task. The uploaded file is not validated
in isolation, so it can also contain snippets that depend on the main configuration.
`caddy:validate`, `caddy:reload`, `caddy:fmt`, and `caddy:config:show` continue to target
`caddy_config_path`. Uploading does not reload Caddy automatically.

When `caddy_upload_path` is omitted, uploads still replace `caddy_config_path`, preserving
the existing single-file setup.
