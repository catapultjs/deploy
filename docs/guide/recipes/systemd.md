---
description: Restart, reload, inspect, and read logs for systemd services.
---

# `recipes/systemd`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/systemd.ts)

```typescript
import '@catapultjs/deploy/recipes/systemd'
```

This recipe manages a service through systemd on the target server. Use it when your application or
supporting service is supervised by `systemctl` and `journalctl`.

It is intentionally generic. Pair it with recipes such as `caddy`, `pm2`, or application recipes
only when the target host actually uses systemd.

**Tasks**

| Task              | Inserted | Description                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `systemd:restart` | —        | Restarts the configured service                 |
| `systemd:reload`  | —        | Reloads the configured service                  |
| `systemd:status`  | —        | Shows `systemctl status` for the service        |
| `systemd:logs`    | —        | Shows recent `journalctl` lines for the service |

Additional manual tasks: `systemd:install`, `systemd:start`, `systemd:stop`,
`systemd:enable`, `systemd:disable`, `systemd:daemon-reload`, and `systemd:check`.

`systemd:restart` checks each configured service with `is-active --quiet` after restarting.
This checks immediate activity; use an application healthcheck to verify readiness.
`cata status` also reports each configured service's activity.

**Configuration**

| Key                  | Type      | Default | Description                                     |
| -------------------- | --------- | ------- | ----------------------------------------------- |
| `systemd_service`    | `string`  | `'app'` | systemd service name                            |
| `systemd_use_sudo`   | `boolean` | `true`  | Prefixes privileged commands with `sudo`        |
| `systemd_logs_lines` | `number`  | `100`   | Number of journal lines shown by `systemd:logs` |

`systemd_services` (`string[]`, non-empty) takes precedence over `systemd_service`.
`systemd_unit_files` (`string[]`) lists local `.service` files for `systemd:install`.
Unit basenames must be unique. Installation uploads files to `.catapult/systemd/`, installs
them under `/etc/systemd/system/`, runs `daemon-reload`, and enables the uploaded units.
Run it explicitly after `deploy:setup`; it does not start or restart services.
With sudo enabled, installation uses root privileges; without sudo, the SSH user must
have permission to write the system unit directory. Existing units are overwritten.

For a web service and worker, a JSON configuration can use:

```json
{
  "store": {
    "systemd_services": ["adonisjs-signal-web", "adonisjs-signal-worker"],
    "systemd_unit_files": [
      "deploy/systemd/adonisjs-signal-web.service",
      "deploy/systemd/adonisjs-signal-worker.service"
    ]
  },
  "after": {
    "deploy:publish": "systemd:restart"
  }
}
```

Tasks are not inserted automatically. When `systemd:restart` is in the deployment pipeline,
manual and automatic rollbacks restart these services after switching `current`, before
running the application healthcheck. Keep unit working directories pointing at `current`.
Importing the recipe only to inspect an independent service does not opt it into rollback.

Example:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'

set('systemd_service', 'caddy')
set('systemd_logs_lines', 200)

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
npx cata task systemd:status --host production
npx cata task systemd:logs --host production
npx cata task systemd:restart --host production
```
