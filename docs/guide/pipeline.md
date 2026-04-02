---
description: Understand the Catapult deployment pipeline — the ordered sequence of SSH tasks that runs on every deploy, and how to customise it.
---

# Pipeline

The pipeline is the sequence of tasks executed during a deployment.

## Default pipeline (without recipes)

```
deploy:lock → deploy:release → deploy:update_code → deploy:shared → deploy:publish → deploy:log_revision → deploy:healthcheck → deploy:unlock → deploy:cleanup
```

## With `git` recipe

The `git` recipe overrides `deploy:update_code` to clone from a git repository and adds `git:check` after `deploy:lock`:

```
deploy:lock → git:check → deploy:release → deploy:update_code → deploy:shared → deploy:publish → deploy:log_revision → deploy:healthcheck → deploy:unlock → deploy:cleanup
```

## With `git` + `adonisjs` + `pm2` recipes

```
deploy:lock → git:check → deploy:release → deploy:update_code → deploy:shared → adonisjs:install → adonisjs:build → adonisjs:migrate → deploy:publish → deploy:log_revision → pm2:start → pm2:save → deploy:healthcheck → deploy:unlock → deploy:cleanup
```

## With `rsync` recipe

The `rsync` recipe overrides `deploy:update_code` to transfer files via rsync. It removes `git:check` from the pipeline, so `branch` is no longer required on hosts:

```
deploy:lock → deploy:release → deploy:update_code → deploy:shared → deploy:publish → deploy:log_revision → deploy:healthcheck → deploy:unlock → deploy:cleanup
```

## Task descriptions

| Task                  | Description                                             |
| --------------------- | ------------------------------------------------------- |
| Task                  | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `deploy:lock`         | Creates a lock file to prevent concurrent deployments   |
| `git:check`           | Verifies the branch exists on the remote (`git` recipe) |
| `deploy:release`      | Creates the release directory                           |
| `deploy:update_code`  | Transfers code to the server (git clone or rsync)       |
| `deploy:shared`       | Creates symlinks for `shared_dirs` and `shared_files`   |
| `adonisjs:install`    | Installs dependencies (frozen lockfile)                 |
| `adonisjs:build`      | Compiles the application                                |
| `adonisjs:migrate`    | Runs migrations                                         |
| `deploy:publish`      | Switches the `current` symlink to the new release       |
| `deploy:log_revision` | Records the deployment in `revisions.log`               |
| `pm2:start`           | Starts or reloads the application via PM2               |
| `pm2:save`            | Persists the PM2 process list                           |
| `deploy:healthcheck`  | Checks that the application is responding               |
| `deploy:unlock`       | Removes the lock file (also called on failure)          |
| `deploy:cleanup`      | Removes old releases                                    |

## Adding a task to the pipeline

```typescript
import { defineConfig, task, run, after, before, remove } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/adonisjs'
import '@catapultjs/deploy/recipes/pm2'

task('cache:clear', () => {
  run('cd {{current_path}} && node ace cache:clear')
})

after('adonisjs:migrate', 'cache:clear')

await defineConfig({ ... })
```

Available functions:

```typescript
after('adonisjs:migrate', 'my-task') // insert after
before('deploy:publish', 'my-task') // insert before
remove('deploy:healthcheck') // remove from pipeline
```

## Removing a task from the pipeline

Use `remove()` to exclude a task from the pipeline:

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
  'adonisjs:install',
  'adonisjs:build',
  'deploy:publish',
  'pm2:start',
  'pm2:save',
  'deploy:healthcheck',
  'deploy:unlock',
  'deploy:cleanup',
])
```

## Overriding a task

Redefining a task replaces its implementation. Place it before `defineConfig`.

```typescript
import { defineConfig, task, cd, run } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/adonisjs'

task('adonisjs:build', () => {
  cd('{{release_path}}')
  run('npm ci')
  run('npm run build:prod')
})

await defineConfig({ ... })
```

## Async task

For operations that require more than a simple SSH command, use an async function with `getContext()`:

```typescript
import { task, getContext } from '@catapultjs/deploy'

task('notify', async () => {
  const { deployCtx } = getContext()
  await fetch(process.env.SLACK_WEBHOOK!, {
    method: 'POST',
    body: JSON.stringify({ text: `Deployed ${deployCtx.release}` }),
  })
})

after('deploy:healthcheck', 'notify')
```

## Running a task manually

Any registered task — whether built-in, added by a recipe, or defined in `deploy.ts` — can be run directly from the terminal.

```bash
npx cata task adonisjs:migrate
npx cata task cache:clear --host staging
```

## Template variables

Available in `cd()` and `run()`:

::: v-pre
| Variable | Value |
| ------------------- | --------------------------------------------------- |
| `{{release_path}}` | `/base/releases/<release>` |
| `{{current_path}}` | `/base/current` |
| `{{shared_path}}` | `/base/shared` |
| `{{releases_path}}` | `/base/releases` |
| `{{base_path}}` | `/base` |
| `{{release}}` | Release name (e.g. `2024-01-15T10-30-00-000Z`) |
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
