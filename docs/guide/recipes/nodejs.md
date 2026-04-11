---
description: Install dependencies and build a Node.js project with the Catapult nodejs recipe.
---

# `recipes/nodejs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nodejs.ts)

```typescript
import '@catapultjs/deploy/recipes/nodejs'
```

Adds Node.js install and build steps to the pipeline. The package manager is configured via `packageManager` in `defineConfig` (defaults to `npm`).

**Tasks**

| Task                        | Inserted                | Description                                    |
| --------------------------- | ----------------------- | ---------------------------------------------- |
| `nodejs:install`            | after `deploy:shared`   | Installs dependencies (frozen lockfile)        |
| `nodejs:install:production` | —                       | Installs production-only dependencies (manual) |
| `nodejs:build`              | after `nodejs:install`  | Runs `<pm> run build`                          |

```typescript
import '@catapultjs/deploy/recipes/nodejs'

export default defineConfig({
  packageManager: 'pnpm',
  // ...
})
```
