---
description: Install dependencies and build a Node.js project with the Catapult nodejs recipe.
---

# `recipes/nodejs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nodejs.ts)

```typescript
import '@catapultjs/deploy/recipes/nodejs'
```

Adds Node.js install and build steps to the pipeline. The package manager is configured via `packageManager` in `defineConfig` (defaults to auto-detected from lock files).

**Tasks**

| Task                        | Inserted                        | Description                                                                                   |
| --------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `nodejs:install`            | after `deploy:update_code`      | Installs dependencies (frozen lockfile) — runs in `{{builder_path}}` or `{{release_path}}` depending on `strategy` |
| `nodejs:install:production` | after `deploy:build:copy`       | Installs production-only dependencies (only when `Strategy.Build`)                           |
| `nodejs:build`              | after `deploy:build:shared`     | Runs `<pm> run build` — runs in `{{builder_path}}` or `{{release_path}}` depending on `strategy` |
| `nodejs:test`               | —                               | Runs `<pm> test` (manual)                                                                     |

```typescript
import '@catapultjs/deploy/recipes/nodejs'

export default defineConfig({
  packageManager: 'pnpm',
  // ...
})
```
