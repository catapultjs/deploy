---
description: Deploy an AdonisJS application with the Catapult adonisjs recipe.
---

# `recipes/adonisjs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/adonisjs.ts)

```typescript
import '@catapultjs/deploy/recipes/adonisjs'
```

This recipe runs the AdonisJS install, build, and migration steps on the server. It does not override `deploy:update_code`, so combine it with a transfer recipe such as `git` or `rsync`.

See the [example AdonisJS project](https://github.com/catapultjs/deploy/tree/main/examples/adonisjs) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/adonisjs/deploy.ts).

**Tasks**

| Task                     | Inserted                   | Description |
| ------------------------ | -------------------------- | ----------- |
| `deploy:install`         | after `deploy:update_code` | Uses the built-in install task in the release directory |
| `deploy:build`           | after `deploy:shared`      | Overrides the built-in build task to run `node ace build`, copy `package.json` and the lock file into `build/`, and create `build/tmp` |
| `ace:migration:run`      | before `deploy:publish`    | Runs `node ace migration:run --force` |
| `ace:migration:rollback` | manual                     | Runs `node ace migration:rollback` |
| `ace:migration:status`   | manual                     | Runs `node ace migration:status` |
| `ace:list:routes`        | manual                     | Runs `node ace list:routes` |

The recipe runs commands from `{{release_path}}/{{adonisjs_path}}`.

**Configuration**

| Key             | Type       | Default                      | Description |
| --------------- | ---------- | ---------------------------- | ----------- |
| `writable_dirs` | `string[]` | `['storage', 'logs', 'tmp']` | Directories created in `shared/` during `cata deploy:setup` |
| `shared_dirs`   | `string[]` | `['storage', 'logs']`        | Directories symlinked from `shared/` into each release |
| `shared_files`  | `string[]` | `['.env']`                   | Files symlinked from `shared/` into each release |
| `adonisjs_path` | `string`   | `''`                         | Sub-path to the AdonisJS app within the repository |

```typescript
import { set } from '@catapultjs/deploy'

set('adonisjs_path', 'apps/api')
set('shared_files', ['.env', '.env.production'])

import '@catapultjs/deploy/recipes/adonisjs'
```

If you want to build AdonisJS locally instead of on the server, follow the [local deployment example](https://github.com/catapultjs/deploy/blob/main/examples/adonisjs/deploy.locale.ts).
