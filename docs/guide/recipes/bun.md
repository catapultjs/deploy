---
description: Install dependencies and build a Bun project with the Catapult bun recipe.
---

# `recipes/bun`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/bun.ts)

```typescript
import '@catapultjs/deploy/recipes/bun'
```

Adds Bun install and build steps to the pipeline.

**Tasks**

| Task                      | Inserted              | Description                                    |
| ------------------------- | --------------------- | ---------------------------------------------- |
| `bun:install`             | after `deploy:shared` | Installs dependencies (frozen lockfile)        |
| `bun:install:production`  | —                     | Installs production-only dependencies (manual) |
| `bun:build`               | after `bun:install`   | Runs `bun run build`                           |

```typescript
import '@catapultjs/deploy/recipes/bun'

export default defineConfig({
  packageManager: 'bun',
  // ...
})
```
