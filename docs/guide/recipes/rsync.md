---
description: Transfer files to the server via rsync with the Catapult rsync recipe.
---

# `recipes/rsync`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/rsync.ts)

```typescript
import '@catapultjs/deploy/recipes/rsync'
```

**Tasks**

| Task                 | Inserted | Description                                             |
| -------------------- | -------- | ------------------------------------------------------- |
| `deploy:update_code` | —        | Overrides the built-in task to transfer files via rsync |

**Configuration**

| Key                 | Type       | Default | Description                    |
| ------------------- | ---------- | ------- | ------------------------------ |
| `rsync_source_path` | `string`   | `./`    | Local source directory         |
| `rsync_excludes`    | `string[]` | `[]`    | Patterns passed to `--exclude` |

```typescript
import { set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/rsync'

set('rsync_source_path', './dist/')
set('rsync_excludes', ['.git', 'node_modules', '.env'])
```
