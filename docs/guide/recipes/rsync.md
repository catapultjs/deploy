---
description: Transfer files to the server via rsync with the Catapult rsync recipe.
---

# `recipes/rsync`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/rsync.ts)

```typescript
import '@catapultjs/deploy/recipes/rsync'
```

**Tasks**

| Task                 | Inserted | Description |
| -------------------- | -------- | ----------- |
| `deploy:update_code` | —        | Overrides the built-in task and syncs a local directory into `releases/<release>/` via rsync |

**Configuration**

| Key                 | Type       | Default | Description |
| ------------------- | ---------- | ------- | ----------- |
| `rsync_source_path` | `string`   | `./`    | Local source directory. A trailing slash is added automatically so only the directory contents are transferred |
| `source_path`       | `string`   | —       | Fallback source directory if `rsync_source_path` is not set |
| `rsync_excludes`    | `string[]` | `[]`    | Patterns passed to `--exclude` |

The recipe always syncs to the new release directory and always uses `--delete`.

Build locally, then sync only generated artifacts:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/rsync'

set('rsync_source_path', './dist')
set('rsync_excludes', ['.env'])

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})
```

Or reuse the generic `source_path` key:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/rsync'

set('source_path', './build')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})
```
