---
description: Deploy an AdonisJS application with the Catapult adonisjs recipe.
---

# `recipes/adonisjs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/adonisjs.ts)

```typescript
import '@catapultjs/deploy/recipes/adonisjs'
```

**Tasks**

| Task                 | Inserted                                                             | Description                                                                                     |
| -------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `adonisjs:install`   | after `deploy:shared`                                                | Installs dependencies — runs in `{{builder_path}}` or `{{release_path}}` depending on `strategy` |
| `adonisjs:build`     | after `adonisjs:install`                                             | Runs `node ace build` — runs in `{{builder_path}}` or `{{release_path}}` depending on `strategy` |
| `adonisjs:migrate`   | after `deploy:build:copy` (Build strategy) or `adonisjs:build` (Direct) | Runs `node ace migration:run`                                                              |

**Configuration**

| Key               | Type       | Default                      | Description                                                  |
| ----------------- | ---------- | ---------------------------- | ------------------------------------------------------------ |
| `writable_dirs`   | `string[]` | `['storage', 'logs', 'tmp']` | Directories created in `shared/` during `cata deploy:setup` |
| `shared_dirs`     | `string[]` | `['storage', 'logs']`        | Directories symlinked from `shared/` into each release       |
| `shared_files`    | `string[]` | `['.env']`                   | Files symlinked from `shared/` into each release             |
| `adonisjs_path`   | `string`   | `''`                         | Sub-path to the AdonisJS app within the repository           |

```typescript
import { set } from '@catapultjs/deploy'

set('shared_files', ['.env', '.env.production'])

import '@catapultjs/deploy/recipes/adonisjs'
```
