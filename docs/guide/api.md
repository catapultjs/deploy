---
description: Complete API reference for @catapultjs/deploy — all exported functions, types and template variables.
---

# API Reference

:::warning Alpha
`@catapultjs/deploy` is currently in alpha. Its API may change between minor releases until it reaches a stable version. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

All functions are exported from `@catapultjs/deploy`.

## Configuration

### `defineConfig(config)`

Initialises the deployment configuration. Must be used as the default export of your `deploy.ts`.

```typescript
export default defineConfig({
  keepReleases: 5,
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
      branch: 'main',
    },
  ],
})
```

**Options**

| Option                | Type              | Description                                         |
| --------------------- | ----------------- | --------------------------------------------------- |
| `hosts`               | `Host[]`          | List of servers to deploy to                        |
| `keepReleases?`       | `number`          | Number of releases to keep (default: `5`)           |
| `repository?`         | `string`          | Git repository URL (auto-detected from origin)      |
| `strategy?`           | `Strategy`        | Deployment strategy: `Strategy.Build` (default) builds in a separate directory then copies to the release; `Strategy.Direct` installs and builds in the release directory directly |
| `packageManager?`     | `PackageManager`  | Package manager used by `pm()`, `pmInstall()`, `pmInstallProd()` (auto-detected from lock files, defaults to `PackageManager.Npm`) |
| `hooks?`              | `Hooks`           | Lifecycle hooks (`beforeDeploy`, `afterDeploy`, …)  |
| `verbose?`            | `0 \| 1 \| 2`    | Verbosity level: `1` prints SSH commands, `2` also prints stdout (default: `1`) |

**Host options**

| Option              | Type                          | Description                                              |
| ------------------- | ----------------------------- | -------------------------------------------------------- |
| `name`              | `string`                      | Host identifier                                          |
| `ssh`               | `string \| SshConfig`         | SSH connection string or object                          |
| `deployPath`        | `string`                      | Absolute path on the server                              |
| `branch?`           | `string \| BranchWithPrompt`  | Branch to deploy                                         |
| `healthcheck?`      | `Healthcheck`                 | Healthcheck configuration (see below)                    |
| `bin?`              | `Record<string, string>`      | Per-host binary path overrides                           |

**SshConfig options**

| Option    | Type     | Description                      |
| --------- | -------- | -------------------------------- |
| `user`    | `string` | SSH user                         |
| `host`    | `string` | SSH host                         |
| `port?`   | `number` | SSH port (default: `22`)         |

```typescript
ssh: { user: 'deploy', host: 'example.com', port: 2222 }
```

**BranchWithPrompt options**

| Option  | Type      | Description                                                              |
| ------- | --------- | ------------------------------------------------------------------------ |
| `name`  | `string`  | Default branch name                                                      |
| `ask`   | `boolean` | Prompt the user to enter a branch name, with `name` as the default value |

```typescript
branch: { name: 'develop', ask: true }
```

**Healthcheck options**

| Option     | Type     | Description                                        |
| ---------- | -------- | -------------------------------------------------- |
| `url?`     | `string` | URL to check after deployment                      |
| `retries?` | `number` | Number of attempts before failing                  |
| `delayMs?` | `number` | Delay between retries in ms (default: `3000`)      |

```typescript
healthcheck: {
  url: 'http://127.0.0.1:3333/health',
  retries: 10,
  delayMs: 3000,
}
```

**bin options**

Map of binary name to absolute path on the server. Used by `bin()` to resolve the correct executable per host.

```typescript
bin: {
  node: '/home/deploy/.nvm/versions/node/v22/bin/node',
  npm: '/home/deploy/.nvm/versions/node/v22/bin/npm',
}
```

---

## Task DSL

These functions are used inside task callbacks to build the SSH command sequence.

### `desc(description)`

Sets a description for the next `task()` call. Used by `cata list:tasks` to display a description column. Optional.

```typescript
import { desc, task, cd, run } from '@catapultjs/deploy'

desc('Builds the application assets')
task('my:build', () => {
  cd('{{release_path}}')
  run('npm run build')
})
```

---

### `task(name, fn)`

Registers a task. If a task with the same name already exists, it is replaced.

```typescript
import { task, cd, run } from '@catapultjs/deploy'

task('my:build', () => {
  cd('{{release_path}}')
  run('npm ci')
  run('npm run build')
})
```

The callback receives a [`TaskContext`](#taskcontext) as its first argument:

```typescript
task('my:build', async ({ host, paths, config, release, logger }) => {
  // ...
})
```

**TaskContext fields**

| Field     | Type      | Description                                   |
| --------- | --------- | --------------------------------------------- |
| `host`    | `Host`    | The host being deployed to                    |
| `paths`   | `Paths`   | Resolved server paths (see below)             |
| `config`  | `Config`  | The resolved deploy configuration             |
| `release` | `string`  | The release name (e.g. `2024-01-15T10-30-00-000Z`) |
| `logger`  | `Logger`  | Logger instance for output                    |

**Paths fields**

| Field          | Value                               |
| -------------- | ----------------------------------- |
| `base`         | `{deployPath}`                      |
| `current`      | `{deployPath}/current`              |
| `releases`     | `{deployPath}/releases`             |
| `release`      | `{deployPath}/releases/{release}`   |
| `shared`       | `{deployPath}/shared`               |
| `cataConfig`   | `{deployPath}/.catapult`            |
| `repo`         | `{deployPath}/.catapult/repo`       |
| `builder`      | `{deployPath}/.catapult/builder`    |
| `lock`         | `{deployPath}/.catapult/deploy.lock`|

---

### `cd(path)`

Sets the working directory for subsequent `run()` calls. Supports [template variables](#template-variables).

```typescript
cd('{{release_path}}')
```

Must be called inside a task callback.

---

### `run(command)`

Queues a shell command to run on the server. Supports [template variables](#template-variables).
All queued commands are sent in a single SSH session at the end of the task, prefixed with `set -e`.

```typescript
run('npm ci')
run('npm run build')
```

Must be called inside a task callback.

---

### `bin(name)`

Resolves a binary path. Checks the current host's `bin` config first, then falls back to the binary name.

```typescript
task('my:build', () => {
  cd('{{release_path}}')
  run(`${bin('node')} my-script.js`)
})
```

Per-host binary paths are configured in `defineConfig`:

```typescript
{
  name: 'production',
  ssh: 'deploy@example.com',
  deployPath: '/home/deploy/myapp',
  bin: {
    node: '/home/deploy/.nvm/versions/node/v22/bin/node',
  },
}
```

---

### `isVerbose()`

Returns the current verbosity level (`0`, `1` or `2`). Truthy when verbose is enabled. Useful for conditional logging inside async tasks.

```typescript
import { task, isVerbose } from '@catapultjs/deploy'

task('my:task', async ({ host, logger }) => {
  if (isVerbose()) logger.step(host.name, 'doing something')
})
```

---

## Pipeline

### `getPipeline()`

Returns a copy of the current pipeline as an array of task names.

```typescript
const pipeline = getPipeline()
// ['deploy:lock', 'deploy:release', ...]
```

---

### `setPipeline(tasks)`

Replaces the entire pipeline.

```typescript
setPipeline([
  'deploy:release',
  'deploy:update_code',
  'deploy:shared',
  'deploy:publish',
  'deploy:unlock',
  'deploy:cleanup',
])
```

---

### `before(existing, newTask)`

Inserts `newTask` immediately before `existing` in the pipeline. Throws if `existing` is not found.

```typescript
before('deploy:publish', 'my:task')
```

---

### `after(existing, newTask)`

Inserts `newTask` immediately after `existing` in the pipeline. Throws if `existing` is not found.

```typescript
after('deploy:publish', 'my:task')
```

---

### `remove(name)`

Removes a task from the pipeline. Throws if the task is not found.

```typescript
remove('deploy:log_revision')
```

---

### `onSetup(fn)`

Registers a callback to run during `cata deploy:setup`, after the base directories are created. Useful for creating shared directories or files specific to your application.

```typescript
import { onSetup } from '@catapultjs/deploy'
import { ssh, q, getPaths } from '@catapultjs/deploy/utils'

onSetup(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  await ssh(host, `mkdir -p ${q(paths.shared + '/uploads')}`)
  logger.step(host.name, 'uploads directory ready')
})
```

---

### `onStatus(fn)`

Registers a callback to run during `cata status`. Useful for displaying additional information such as a process manager version or queue state.

```typescript
import { onStatus } from '@catapultjs/deploy'
import { ssh } from '@catapultjs/deploy/utils'

onStatus(async (_ctx, host, logger) => {
  const { stdout } = await ssh(host, `set +e\nmy-service --version || true`)
  logger.log(`my-service ${stdout.trim() || 'unavailable'}`)
})
```

---

## Store

Key/value store for sharing configuration between `deploy.ts` and recipes.

**Reserved keys**

| Key               | Type       | Default | Used by                                          |
| ----------------- | ---------- | ------- | ------------------------------------------------ |
| `shared_dirs`     | `string[]` | `[]`    | `deploy:shared`, `deploy:build:shared`           |
| `shared_files`    | `string[]` | `[]`    | `deploy:shared`, `deploy:build:shared`           |
| `writable_dirs`   | `string[]` | `[]`    | `deploy:setup` (via `onSetup`)                   |
| `build_output`    | `string`   | `'build'` | `deploy:build:copy` — subdirectory to copy from the build directory into the release |

### `set(key, value)`

Stores a value under the given key.

```typescript
import { set } from '@catapultjs/deploy'

set('shared_dirs', ['storage', 'logs'])
```

---

### `get(key, defaultValue?)`

Retrieves a value from the store. Returns `defaultValue` if the key is not set.

```typescript
import { get } from '@catapultjs/deploy'

const dirs = get<string[]>('shared_dirs', [])
```

---

### `has(key)`

Returns `true` if the key is set in the store.

```typescript
import { has } from '@catapultjs/deploy'

if (has('build_output')) {
  // ...
}
```

---

## Package manager

### `pm()`

Returns the current package manager binary. Reads `packageManager` from `defineConfig`, defaults to `npm`.

```typescript
run(`${pm()} run build`)
```

---

### `pmInstall()`

Returns the install command with frozen lockfile for the current package manager.

| `packageManager` | Command                          |
| ---------------- | -------------------------------- |
| `npm`            | `npm ci`                         |
| `pnpm`           | `pnpm install --frozen-lockfile` |
| `yarn`           | `yarn install --frozen-lockfile` |

```typescript
run(pmInstall())
```

---

### `pmInstallProd()`

Returns the production-only install command for the current package manager.

| `packageManager` | Command                     |
| ---------------- | --------------------------- |
| `npm`            | `npm install --omit=dev`    |
| `pnpm`           | `pnpm install --prod`       |
| `yarn`           | `yarn install --production` |

```typescript
run(pmInstallProd())
```

---

## Template variables

Available in `cd()` and `run()`:

::: v-pre
| Variable            | Value                                          |
| ------------------- | ---------------------------------------------- |
| `{{release_path}}`  | `/base/releases/<release>`                     |
| `{{current_path}}`  | `/base/current`                                |
| `{{shared_path}}`   | `/base/shared`                                 |
| `{{releases_path}}` | `/base/releases`                               |
| `{{builder_path}}`    | `/base/.catapult/builder`                      |
| `{{base_path}}`     | `/base`                                        |
| `{{release}}`       | Release name (e.g. `2024-01-15T10-30-00-000Z`) |
:::

Where `/base` is the `deployPath` defined on the host.
