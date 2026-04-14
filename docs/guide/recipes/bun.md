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

| Task                      | Inserted                    | Description                                                        |
| ------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `bun:install`             | after `deploy:update_code`  | Installs dependencies (frozen lockfile) — runs in `{{builder_path}}` |
| `bun:install:production`  | after `deploy:build:copy`   | Installs production-only dependencies (only when `Strategy.Build`) |
| `bun:build`               | after `deploy:build:shared` | Runs `bun run build` — runs in `{{builder_path}}`                    |

```typescript
import '@catapultjs/deploy/recipes/bun'

export default defineConfig({
  packageManager: 'bun',
  // ...
})
```
