---
name: cata-recipe
description: Create or modify a Catapult (@catapultjs/deploy) recipe. Use when writing deployment tasks, customizing the deploy pipeline, adding setup/status hooks, or packaging a reusable recipe for the SSH deployment tool Catapult.
---

# Writing a Catapult recipe

A recipe is a JavaScript/TypeScript module that registers tasks and inserts them into the deployment pipeline as a side effect of being imported. Users activate it with a bare import in their `deploy.ts`:

```typescript
import './recipes/my-recipe.ts'
```

Full docs: https://catapultjs.com/guide/creating-recipes

## Conventions

- Namespace every task with a recipe prefix: `my-recipe:build`, not `build`.
- Call `desc('…')` immediately before each `task()` so the task shows a description in `cata list:tasks`.
- Tasks that queue remote commands use the DSL (`cd()`, `run()`); tasks that need command output or conditionals use `ssh()` directly with `set -e` and `q()` for quoting.
- Resolve binaries with `bin('node')` instead of hardcoding, so users can override paths per host via `host.bin`.
- Expose recipe options through the store (`get()`/`set()`), never through module-level mutable state.

## Basic structure

```typescript
import { type TaskContext, task, desc, cd, run, after, bin } from '@catapultjs/deploy'
import { ssh, q } from '@catapultjs/deploy/utils'

// TypeScript: register task names for autocompletion
declare module '@catapultjs/deploy' {
  interface TaskRegistry {
    'my-recipe:build': true
  }
}

desc('Builds the application in the release directory')
task('my-recipe:build', () => {
  cd('{{release_path}}')
  run(`${bin('node')} --run build`)
})

// Insert into the pipeline (deduplicated: re-adding moves the task)
after('deploy:update_code', 'my-recipe:build')
```

Pipeline functions: `after(existing, newTask)`, `before(existing, newTask)`, `remove(name)`, `inPipeline(name)`, `getPipeline()`, `setPipeline(tasks)`.

Default pipeline: `deploy:lock`, `deploy:release`, `deploy:update_code`, `deploy:shared`, `deploy:publish`, `deploy:log_revision`, `deploy:healthcheck`, `deploy:unlock`, `deploy:cleanup`. Recipes may override a built-in task by registering the same name (e.g. `git`/`rsync` recipes provide `deploy:update_code`).

Use `inPipeline()` to attach relative to optional steps (`deploy:healthcheck` is removed when no host defines one). Insertion deduplicates: re-adding a task moves it, the last position wins.

Three tasks are registered but not inserted: `deploy:install` (package manager install), `deploy:build` (`pm run build`), `deploy:test` (`pm run test`). Prefer inserting or overriding them over inventing new install/build tasks, like the `adonisjs` and `nuxt` recipes do.

## Task context and raw SSH

The task function receives a `TaskContext`: `{ host, paths, config, release, logger }`. Use it for output capture or host-specific logic:

```typescript
desc('Shows service logs')
task('my-recipe:logs', async ({ host, paths, logger }: TaskContext) => {
  const { stdout } = await ssh(host, `set -e\ncd ${q(paths.current)}\nmy-service logs --tail 50`)
  logger.log(stdout.trim())
})
```

Always write display output through `ctx.logger` (not `console.log`): the programmatic API captures it and returns it from `catapult.task()`.

`paths` fields: `base`, `releases`, `release`, `current`, `shared`, `cataConfig`, `repo`, `builder`, `lock`.

Template variables in `cd()`/`run()` strings: `{{release_path}}`, `{{current_path}}`, `{{shared_path}}`, `{{releases_path}}`, `{{base_path}}`, `{{release}}`.

Other DSL helpers: `local(command, { cwd? })` runs on the local machine, `upload(localPath, remotePath)` / `download(remotePath, localPath)` transfer over SCP, `isVerbose(level)` checks verbosity.

## Hooks

`onSetup()` runs during `cata deploy:setup`, after base directories exist:

```typescript
import { onSetup } from '@catapultjs/deploy'
import { ssh, q, getPaths } from '@catapultjs/deploy/utils'

onSetup(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  await ssh(host, `set -e\nmkdir -p ${q(paths.shared + '/storage')}`)
  logger.step(host.name, 'storage ready')
})
```

`onStatus()` runs during `cata status`. Return an object: each key becomes an aligned line in text mode and is merged into the host entry of `status --json` and `catapult.status()`. Output written via the `logger` argument only appears in text mode.

```typescript
import { onStatus } from '@catapultjs/deploy'

onStatus(async (_ctx, host) => {
  const { stdout } = await ssh(host, `set +e\nmy-service --version || true`)
  return { 'my-service': stdout.trim() || 'unavailable' }
})
```

## Configurable options

```typescript
import { task, run, get } from '@catapultjs/deploy'

task('my-recipe:sync', () => {
  const excludes = get<string[]>('my_recipe_excludes', [])
  run(`rsync ${excludes.map((e) => `--exclude=${e}`).join(' ')} …`)
})
```

Users set values in `deploy.ts` with `set('my_recipe_excludes', […])` before or after the import. Two store keys have built-in meaning during setup: `writable_dirs` (string[], created under `shared/`) and `shared_files` (string[], touched under `shared/`).

## Checklist before shipping

1. Tasks namespaced and described with `desc()`.
2. `TaskRegistry` augmented for TypeScript users.
3. Remote commands quoted with `q()` and prefixed with `set -e` (or `set +e` when failure is expected).
4. Display tasks write to `ctx.logger`, status hooks return data objects.
5. Reusable recipes can be contributed to the `contrib/` directory of https://github.com/catapultjs/deploy via pull request.
