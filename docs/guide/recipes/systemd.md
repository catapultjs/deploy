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

| Task              | Inserted | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `systemd:restart` | —        | Restarts the configured service                  |
| `systemd:reload`  | —        | Reloads the configured service                   |
| `systemd:status`  | —        | Shows `systemctl status` for the service         |
| `systemd:logs`    | —        | Shows recent `journalctl` lines for the service  |

**Configuration**

| Key                  | Type      | Default | Description                                  |
| -------------------- | --------- | ------- | -------------------------------------------- |
| `systemd_service`    | `string`  | `'app'` | systemd service name                         |
| `systemd_use_sudo`   | `boolean` | `true`  | Prefixes privileged commands with `sudo`     |
| `systemd_logs_lines` | `number`  | `100`   | Number of journal lines shown by `systemd:logs` |

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
