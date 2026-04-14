---
description: Understand the Catapult deployment pipeline — the ordered sequence of SSH tasks that runs on every deploy, and how to customise it.
---

# Pipeline

:::warning Alpha
`@catapultjs/deploy` is currently in alpha. Its API may change between minor releases until it reaches a stable version. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

The pipeline is the ordered sequence of tasks executed on each server during a deployment.

## Default pipeline

```
deploy:lock → deploy:release → deploy:update_code → deploy:build:shared → deploy:build:copy → deploy:shared → deploy:publish → deploy:log_revision → deploy:healthcheck → deploy:unlock → deploy:cleanup
```

| Task                    | Description                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `deploy:lock`           | Creates a lock file to prevent concurrent deployments              |
| `deploy:release`        | Creates the release directory                                      |
| `deploy:update_code`    | Transfers code to the server (overridden by recipe)                |
| `deploy:build:shared`   | Symlinks `shared_dirs` and `shared_files` into the build directory |
| `deploy:build:copy`     | Copies build output from the build directory into the release      |
| `deploy:shared`         | Symlinks `shared_dirs` and `shared_files` into the release         |
| `deploy:publish`        | Switches the `current` symlink to the new release                  |
| `deploy:log_revision`   | Records the deployment as JSON in `.catapult/revisions.log`        |
| `deploy:healthcheck`    | Checks that the application is responding                          |
| `deploy:unlock`         | Removes the lock file (also called on failure)                     |
| `deploy:cleanup`        | Removes old releases                                               |

`deploy:build:shared` and `deploy:build:copy` are automatically removed from the pipeline when `strategy` is not `Strategy.Build`.

`deploy:healthcheck` is automatically removed from the pipeline if no host defines a `healthcheck`.

## Adding a task

Use `after()` or `before()` to insert a task relative to an existing one:

```typescript
import { task, cd, run, after, before } from '@catapultjs/deploy'

task('cache:clear', () => {
  cd('{{current_path}}')
  run('node ace cache:clear')
})

after('deploy:publish', 'cache:clear')
before('deploy:cleanup', 'cache:clear')
```

## Removing a task

```typescript
import { remove } from '@catapultjs/deploy'

remove('deploy:healthcheck')
```

## Replacing the entire pipeline

```typescript
import { setPipeline } from '@catapultjs/deploy'

setPipeline([
  'deploy:release',
  'deploy:update_code',
  'deploy:shared',
  'deploy:publish',
  'deploy:unlock',
  'deploy:cleanup',
])
```

## Overriding a task

Redefining a task replaces its implementation. Place it before `defineConfig`:

```typescript
import { defineConfig, task, cd, run } from '@catapultjs/deploy'

task('deploy:update_code', () => {
  cd('{{release_path}}')
  run('rsync ...')
})

export default defineConfig({ ... })
```

## Async task

For operations that require more than SSH commands, use an async function and destructure the `TaskContext` parameter:

```typescript
import { type TaskContext, task, after } from '@catapultjs/deploy'

task('notify', async ({ release }: TaskContext) => {
  await fetch(process.env.SLACK_WEBHOOK!, {
    method: 'POST',
    body: JSON.stringify({ text: `Deployed ${release}` }),
  })
})

after('deploy:healthcheck', 'notify')
```

## Running a task manually

Any registered task can be run directly from the terminal:

```bash
npx cata task deploy:update_code
npx cata task cache:clear --host staging
```

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

```typescript
import { task, cd, run } from '@catapultjs/deploy'

task('my:task', () => {
  cd('{{release_path}}')
  run('cp {{shared_path}}/.env {{release_path}}/.env')
  run('echo "Release: {{release}}"')
})
```
