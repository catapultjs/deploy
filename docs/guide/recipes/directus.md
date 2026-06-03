---
description: Manage Directus database migrations and schema snapshots with the Catapult directus recipe.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `recipes/directus`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/directus.ts)

```typescript
import '@catapultjs/deploy/recipes/directus'
```

This recipe runs the Directus migration and schema tasks on the server. It does not override `deploy:update_code`, so combine it with a transfer recipe such as `git` or `rsync`.

**Tasks**

| Task                        | Inserted | Description                                              |
| --------------------------- | -------- | -------------------------------------------------------- |
| `directus:database:migrate` | —        | Runs `directus database migrate:latest`                  |
| `directus:snapshot:create`  | —        | Runs `directus schema snapshot <directus_snapshot_path>` |
| `directus:snapshot:apply`   | —        | Runs `directus schema apply -y <directus_snapshot_path>` |

The recipe runs commands from `{{release_path}}/{{directus_path}}`.

**Configuration**

| Key                      | Type       | Default             | Description                                                 |
| ------------------------ | ---------- | ------------------- | ----------------------------------------------------------- |
| `writable_dirs`          | `string[]` | `['uploads']`       | Directories created in `shared/` during `cata deploy:setup` |
| `shared_dirs`            | `string[]` | `['uploads']`       | Directories symlinked from `shared/` into each release      |
| `shared_files`           | `string[]` | `['.env']`          | Files symlinked from `shared/` into each release            |
| `directus_path`          | `string`   | `''`                | Sub-path to the Directus app within the repository          |
| `directus_snapshot_path` | `string`   | `'./snapshot.yaml'` | Snapshot file path used by the schema tasks                 |

```typescript
import { set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/directus'

set('directus_path', 'apps/cms')
set('directus_snapshot_path', './database/snapshot.yaml')
```

Run the tasks manually from the terminal:

```bash
npx cata task directus:database:migrate
npx cata task directus:snapshot:apply --host staging
```
