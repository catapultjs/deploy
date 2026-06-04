---
description: Deploy an AdonisJS application with a local build and artifact upload.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `recipes/adonisjs_local`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/adonisjs_local.ts)

```typescript
import '@catapultjs/deploy/recipes/adonisjs_local'
```

This recipe keeps the usual AdonisJS shared paths and `ace:*` tasks, but switches the deployment flow to a local build plus artifact upload. Use [`recipes/adonisjs`](./adonisjs) if you prefer the standard remote-build workflow.

**Tasks**

| Task                     | Inserted                | Description |
| ------------------------ | ----------------------- | ----------- |
| `deploy:build`           | before `deploy:lock`    | Runs `node ace build` on the local machine and prepares the `build/` artifact |
| `deploy:update_code`     | —                       | Overrides the built-in task and uploads the local build output to `releases/<release>` via SCP |
| `deploy:install`         | after `deploy:shared`   | Installs production dependencies in the release with `pmInstallProd()` |
| `ace:migration:run`      | before `deploy:publish` | Runs `node ace migration:run --force` |
| `ace:migration:rollback` | manual                  | Runs `node ace migration:rollback` |
| `ace:migration:status`   | manual                  | Runs `node ace migration:status` |
| `ace:list:routes`        | manual                  | Runs `node ace list:routes` |

**Configuration**

| Key             | Type       | Default                      | Description |
| --------------- | ---------- | ---------------------------- | ----------- |
| `writable_dirs` | `string[]` | `['storage', 'logs', 'tmp']` | Directories created in `shared/` during `cata deploy:setup` |
| `shared_dirs`   | `string[]` | `['storage', 'logs']`        | Directories symlinked from `shared/` into each release |
| `shared_files`  | `string[]` | `['.env']`                   | Files symlinked from `shared/` into each release |
| `adonisjs_path` | `string`   | `''`                         | Sub-path to the AdonisJS app within the repository |
| `source_path`   | `string`   | `<adonisjs_path>/build/.`    | Local build directory uploaded to the release; `./build` is normalized to `./build/.` |

```typescript
import { set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/adonisjs_local'

set('source_path', './build')
```

The recipe copies `package.json`, the detected lock file, and, when present, `pnpm-workspace.yaml`, `.npmrc`, and `ecosystem.config.cjs` into the local `build/` directory before uploading it. When `source_path` targets a directory, the recipe automatically uploads its contents, even if you omit the trailing `/.`.
