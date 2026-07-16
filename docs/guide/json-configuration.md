---
description: Configure Catapult declaratively with strict JSON, built-in recipes, custom tasks and pipeline controls.
outline: deep
---

# JSON configuration

Catapult can load a deployment from strict JSON when the deployment does not need executable configuration code. The CLI auto-detects these names at the project root:

- `deploy.config.json`
- `deploy.json`

You can also load another JSON file with `cata <command> --config <path>` or `cata <command> -c <path>`.

Run `npx @catapultjs/deploy init` and choose **JSON** to generate `deploy.config.json`. The generated file points editors to Catapult's public JSON schema:

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "config": {
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@example.com",
        "deployPath": "/home/deploy/myapp",
        "branch": "main"
      }
    ]
  }
}
```

This is JSON, not a JavaScript object literal: property names and strings must use double quotes, and comments, single quotes and trailing commas are not allowed. Catapult validates the complete document before it connects to a host. Unknown properties, unsupported recipes, malformed task steps and invalid pipeline declarations are rejected.

## Top-level fields

| Field      | Required | Description                                                                                          |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `$schema`  | No       | Editor validation and completion. Use `https://catapultjs.com/schema/deploy.schema.json`.             |
| `version`  | Yes      | JSON format version. The only supported value is `1`.                                                |
| `recipes`  | No       | Built-in recipes to load, in array order.                                                            |
| `config`   | Yes      | Core Catapult configuration and hosts.                                                               |
| `store`    | No       | JSON values exposed to recipes through Catapult's store.                                             |
| `tasks`    | No       | Declarative custom tasks.                                                                            |
| `pipeline` | No       | Complete ordered task list, equivalent to `setPipeline()`.                                           |
| `remove`   | No       | Task names to remove from the current pipeline.                                                      |
| `before`   | No       | Map pipeline targets to one or more registered tasks inserted before them.                           |
| `after`    | No       | Map pipeline targets to one or more registered tasks inserted after them.                            |

Additional top-level fields are not accepted.

## Recipes

Use recipe names rather than module import paths:

```json
{
  "recipes": ["git", "pm2"]
}
```

The JSON format accepts this closed list of recipes:

- `adonisjs`
- `adonisjs_local`
- `astro`
- `astro_static`
- `caddy`
- `directus`
- `git`
- `nestjs`
- `nextjs`
- `nextjs_static`
- `nuxt`
- `nuxt_static`
- `pm2`
- `redis`
- `rsync`
- `systemd`
- `tanstack`
- `vitepress`

Recipes are registered before custom `tasks` and pipeline controls are applied. External recipes and local recipe modules require a TypeScript or JavaScript config.

## Config

`config` contains the serializable part of [`defineConfig()`](/guide/api#configuration):

| Field            | Type                           | Notes                                                         |
| ---------------- | ------------------------------ | ------------------------------------------------------------- |
| `hosts`          | `Host[]`                       | Required, with at least one host and unique host names.       |
| `keepReleases`   | integer                        | Number of releases to keep; must be at least `1`.             |
| `repository`     | string                         | Repository URL, otherwise Catapult can detect the git origin. |
| `packageManager` | `npm`, `pnpm`, `yarn` or `bun` | Package manager used by built-in tasks and recipes.           |
| `verbose`        | `0`, `1`, `2` or `3`           | Silent, normal, trace or debug output.                        |

Each host accepts:

| Field         | Type             | Notes                                                                                                                       |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `name`        | string           | Required identifier used by `--host`.                                                                                       |
| `ssh`         | string or object | Required. Use `"user@host"` or `{ "user": "deploy", "host": "example.com", "port": 22 }`.                                   |
| `deployPath`  | string           | Required absolute path on the server.                                                                                       |
| `branch`      | string or object | A branch name, or `{ "name": "main", "ask": true }` to prompt in the CLI.                                                   |
| `healthcheck` | object           | Optional `url`, `retries` and `delayMs` values.                                                                             |
| `bin`         | object           | Optional per-host binary paths, such as `{ "node": "/opt/node/bin/node" }`; built-in recipes can resolve them with `bin()`. |

Function-valued lifecycle hooks are intentionally excluded from JSON. Static per-host `bin` values are supported, but a declarative task step cannot call the dynamic `bin()` helper itself.

## Store values

`store` is the declarative equivalent of calling `set(key, value)`. The schema accepts documented core and built-in recipe keys and validates each value's type:

```json
{
  "store": {
    "shared_files": [".env"],
    "shared_dirs": ["storage", "logs"],
    "rsync_excludes": [".env", "node_modules"]
  }
}
```

Consult the [recipe guides](/guide/recipes/) for each recipe's supported store keys. Unknown keys are rejected; use a TypeScript or JavaScript config for custom recipes with their own store contract.

## Custom tasks

Every key under `tasks` registers a task. Its value is either an array of steps or an object with an optional description and a `steps` array:

```json
{
  "tasks": {
    "app:build": {
      "description": "Install dependencies and build the application",
      "steps": [{ "cd": "{{release_path}}" }, { "run": "npm ci" }, { "run": "npm run build" }]
    },
    "artifact:copy": [
      { "local": { "command": "npm run build", "cwd": "./frontend" } },
      { "upload": { "local": "./frontend/dist", "remote": "{{release_path}}/public" } },
      {
        "download": {
          "remote": "{{release_path}}/manifest.json",
          "local": "./artifacts/manifest.json"
        }
      }
    ]
  }
}
```

Task steps run in their declared order:

| Step                                                  | Runs on         | Description                                        |
| ----------------------------------------------------- | --------------- | -------------------------------------------------- |
| `{ "cd": "path" }`                                    | Remote host     | Changes directory for consecutive remote commands. |
| `{ "run": "command" }`                                | Remote host     | Runs a shell command over SSH.                     |
| `{ "local": { "command": "...", "cwd": "..." } }`     | Local machine   | Runs a local shell command; `cwd` is optional.     |
| `{ "upload": { "local": "...", "remote": "..." } }`   | Local to remote | Uploads a file or directory with SCP.              |
| `{ "download": { "remote": "...", "local": "..." } }` | Remote to local | Downloads a file or directory with SCP.            |

Remote paths and commands support `{{release_path}}`, `{{current_path}}`, `{{shared_path}}`, `{{releases_path}}`, `{{base_path}}` and `{{release}}` placeholders.

A local, upload or download step flushes the current remote command batch. Repeat `cd` before later remote `run` steps when a task mixes remote commands with local or transfer steps.

Registering a task does not add it to the deployment pipeline. Place it with `before` or `after`, include it in `pipeline`, or run it manually with `cata task <name>`.

## Pipeline customization

Each field maps directly to the corresponding Catapult pipeline function:

```json
{
  "remove": ["deploy:healthcheck"],
  "before": {
    "deploy:publish": "app:verify"
  },
  "after": {
    "deploy:shared": ["app:install", "app:build"]
  }
}
```

| Field      | Equivalent API                 | Effect                                                                   |
| ---------- | ------------------------------ | ------------------------------------------------------------------------ |
| `pipeline` | `setPipeline(["task", "..."])` | Replaces the complete pipeline with the listed registered tasks.         |
| `remove`   | `remove("task")`               | Removes each task from the pipeline without unregistering it.            |
| `before`   | `before("target", "task")`     | Inserts one task, or an ordered task array, before each pipeline target. |
| `after`    | `after("target", "task")`      | Inserts one task, or an ordered task array, after each pipeline target.  |

The application order is fixed and does not depend on the top-level property order in the JSON document:

1. `pipeline` replaces the current pipeline when present.
2. `remove` removes tasks.
3. `before` inserts tasks before their targets.
4. `after` inserts tasks after their targets.

Arrays under `before` and `after` preserve their declared order in the final pipeline. Every inserted task must be registered, every target must exist in the pipeline when its placement is applied, and the final pipeline must contain at least one task.

To keep mappings independent of JSON object member order, a task can appear only once across `before` and `after`. A placed task cannot also be a placement target or appear under `remove`. Use an array under one target to place a sequence of tasks.

Providing `pipeline` replaces recipe insertions as well as the default sequence. It must contain at least one task. Recipes still register their tasks, but the JSON configuration becomes responsible for listing the complete execution order:

```json
{
  "pipeline": [
    "deploy:lock",
    "deploy:release",
    "deploy:update_code",
    "deploy:shared",
    "app:build",
    "deploy:publish",
    "deploy:unlock",
    "deploy:cleanup"
  ]
}
```

When replacing the pipeline, retain `deploy:lock` and `deploy:unlock` unless concurrent deployments are acceptable. Omitting `deploy:log_revision` disables revision history, and omitting `deploy:cleanup` disables release pruning. Inspect the result with `cata pipeline` and the registered tasks with `cata list:tasks`.

## Complete example

The original object-literal shape can be expressed as strict JSON like this:

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "recipes": ["git"],
  "config": {
    "keepReleases": 2,
    "verbose": 0,
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@192.168.122.148",
        "deployPath": "/home/deploy/deploy-test",
        "branch": "master"
      }
    ]
  },
  "tasks": {
    "app:build": {
      "description": "Install dependencies and build the application",
      "steps": [{ "cd": "{{release_path}}" }, { "run": "npm ci" }, { "run": "npm run build" }]
    }
  },
  "after": {
    "deploy:shared": "app:build"
  }
}
```

Three details differ from the initial proposal:

1. `recipes` contains built-in recipe names, not import paths such as `recipes/git`.
2. Declaring `app:build` only registers it; the `after` mapping inserts it after `deploy:shared`, once shared paths are in place.
3. Catapult unlocks a failed deployment automatically, so an `after` mapping from `deploy:failed` to `deploy:unlock` is neither needed nor part of the JSON model.

`ace:migration:run` is registered and inserted only by the `adonisjs` recipe. To remove it, list that recipe and then add the task under `remove`:

```json
{
  "recipes": ["git", "adonisjs"],
  "remove": ["ace:migration:run"]
}
```

## When to use TypeScript or JavaScript

Use `deploy.ts` or `deploy.config.js` when the deployment needs executable behavior, including:

- lifecycle callbacks or `onSetup`/`onStatus` hooks
- external or project-local recipes
- custom tasks that need dynamic binary resolution through `bin()`
- conditional pipeline changes such as `inPipeline()` checks
- custom tasks with loops, branching, API calls or arbitrary asynchronous code

JSON is intended for deployments that can be fully described as validated data. TypeScript and JavaScript remain the escape hatch for executable configuration.
