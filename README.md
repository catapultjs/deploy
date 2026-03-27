# Deployer

SSH deployment tool for Node.js applications.

## Installation

```bash
npm install zx
```

## Usage

Create a `deploy.ts` file at the root of your project:

```typescript
import { defineConfig, set } from './bin/deployer.ts'
import './bin/recipes/adonisjs.ts'
import './bin/recipes/pm2.ts'

await defineConfig({
  keepReleases: 5,

  repository: 'git@github.com:user/myapp.git', // optional, auto-detected from origin
  healthcheckRetries: 10,
  healthcheckDelayMs: 3000,

  hosts: [
    {
      name: 'staging',
      ssh: 'deploy@staging.example.com',
      deployPath: '/home/deploy/staging/myapp',
      branch: 'develop',
      healthcheckUrl: 'http://127.0.0.1:3333/health',
    },
    {
      name: 'production',
      ssh: 'deploy@prod.example.com',
      deployPath: '/home/deploy/prod/myapp',
      branch: 'main',
      healthcheckUrl: 'http://127.0.0.1:3333/health',
    },
  ],

  verbose: true, // prints SSH commands in the terminal (default: true)
})
```

## Commands

```bash
# Deploy
node bin/cli.ts deploy

# Initial server setup (create directories)
node bin/cli.ts deploy:setup

# Rollback to the previous release
node bin/cli.ts rollback

# Server status
node bin/cli.ts status

# List releases
node bin/cli.ts list-releases

# Target a specific host
node bin/cli.ts deploy --host staging
```

## Pipeline

The pipeline is the sequence of tasks executed during a deployment.

### Default pipeline (without recipes)

```
deploy:release → deploy:upload → deploy:publish → deploy:log → deploy:healthcheck → deploy:cleanup
```

### With `adonisjs` + `pm2` recipes

```
deploy:release → deploy:upload → adonisjs:shared → adonisjs:build → adonisjs:migrate
→ deploy:publish → deploy:log → pm2:start → deploy:healthcheck → deploy:cleanup
```

### Task descriptions

| Task                 | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `deploy:release`     | Creates the release directory                                    |
| `deploy:upload`      | Clones the git repository on the server                          |
| `adonisjs:shared`    | Creates symlinks to shared directories (storage, logs, .env)     |
| `adonisjs:build`     | Installs dependencies and compiles                               |
| `adonisjs:migrate`   | Runs migrations                                                  |
| `deploy:publish`     | Switches the `current` symlink to the new release                |
| `deploy:log`         | Records the deployment in `revisions.log`                        |
| `pm2:start`          | Starts or reloads the application via PM2                        |
| `deploy:healthcheck` | Checks that the application is responding                        |
| `deploy:cleanup`     | Removes old releases                                             |

## Recipes

Recipes add tasks to the pipeline automatically upon import.

### `recipes/adonisjs.ts`

Adds the `adonisjs:shared`, `adonisjs:build`, and `adonisjs:migrate` tasks for an AdonisJS application.
Also creates shared directories (`storage`, `logs`, `tmp`, `.env`) during `deploy:setup`.

```typescript
import './bin/recipes/adonisjs.ts'
```

### `recipes/pm2.ts`

Adds the `pm2:start` task to start or reload processes via PM2.
The `ecosystem.config.cjs` file must be present in the project.

```typescript
import './bin/recipes/pm2.ts'
```

### `recipes/rsync.ts`

Replaces the default transfer mode (git) with rsync.

```typescript
import { set } from './bin/deployer.ts'
import './bin/recipes/rsync.ts'

set('rsync_excludes', ['.git', 'node_modules', '.env', 'storage', 'tmp', 'logs'])
```

> With this recipe, `branch` is no longer required on hosts.

## Upload: git vs rsync

By default, `deploy:upload` performs a `git clone` on the server:

```typescript
hosts: [
  {
    name: 'staging',
    ssh: 'deploy@staging.example.com',
    deployPath: '/home/deploy/staging/myapp',
    branch: 'develop', // required in git mode
  },
]
```

The `repository` is auto-detected from `git remote get-url origin` if not specified.

To use rsync instead, import the `recipes/rsync.ts` recipe (see above).

## Recipe configuration: set() / get()

Recipes can expose their own configuration via `set()` / `get()`:

```typescript
import { set } from './bin/deployer.ts'

set('rsync_excludes', ['.git', 'node_modules', '.env'])
```

This allows extending the configuration without modifying the base `Config`.

## Binaries: bin()

By default, recipes use `node`, `npm`, etc. from the server's `PATH`.
If the server uses nvm, fnm, or a custom path, they can be overridden:

```typescript
import { set } from './bin/deployer.ts'

set('bin/node', '/home/deploy/.nvm/versions/node/v22.14.0/bin/node')
set('bin/npm', '/home/deploy/.nvm/versions/node/v22.14.0/bin/npm')
```

The `bin()` helper is also available in custom tasks:

```typescript
import { task, bin, run, cd } from './bin/deployer.ts'

task('my:task', () => {
  cd('{{release_path}}')
  run(`${bin('node')} my-script.js`)
})
```

## Overriding a task

Redefining a task replaces its implementation. Place it before `defineConfig`.

```typescript
import { defineConfig, task, cd, run } from './bin/deployer.ts'
import './bin/recipes/adonisjs.ts'

task('adonisjs:build', () => {
  cd('{{release_path}}')
  run('npm ci')
  run('npm run build:prod')
})

await defineConfig({ ... })
```

### Template variables

Available in `cd()` and `run()`:

| Variable            | Value                                               |
| ------------------- | --------------------------------------------------- |
| `{{release_path}}`  | `/base/releases/<release>`                          |
| `{{current_path}}`  | `/base/current`                                     |
| `{{shared_path}}`   | `/base/shared`                                      |
| `{{releases_path}}` | `/base/releases`                                    |
| `{{base_path}}`     | `/base`                                             |
| `{{release}}`       | Release name (e.g. `2024-01-15T10-30-00-000Z`)      |

## Adding a task to the pipeline

```typescript
import { defineConfig, task, run, after, before, remove } from './bin/deployer.ts'
import './bin/recipes/adonisjs.ts'
import './bin/recipes/pm2.ts'

task('cache:clear', () => {
  run('cd {{current_path}} && node ace cache:clear')
})

after('adonisjs:migrate', 'cache:clear')

await defineConfig({ ... })
```

Available functions:

```typescript
after('adonisjs:migrate', 'my-task')  // insert after
before('deploy:publish', 'my-task')   // insert before
remove('deploy:healthcheck')          // remove from pipeline
```

## Async task

For operations that require more than a simple SSH command, use an async function with `getContext()`:

```typescript
import { task, getContext } from './bin/deployer.ts'

task('notify', async () => {
  const { deployCtx } = getContext()
  await fetch(process.env.SLACK_WEBHOOK!, {
    method: 'POST',
    body: JSON.stringify({ text: `Deployed ${deployCtx.release}` }),
  })
})

after('deploy:healthcheck', 'notify')
```

## Replacing the entire pipeline

```typescript
import { setPipeline } from './bin/deployer.ts'

setPipeline([
  'deploy:release',
  'deploy:upload',
  'adonisjs:build',
  'deploy:publish',
  'pm2:start',
  'deploy:healthcheck',
  'deploy:cleanup',
])
```

## Running a task manually

Any registered task — whether built-in, added by a recipe, or defined in `deploy.ts` — can be run directly from the terminal.

```bash
node bin/cli.ts adonisjs:migrate
node bin/cli.ts cache:clear --host staging
```

### `pm2` recipe tasks

| Task          | Description                              |
| ------------- | ---------------------------------------- |
| `pm2:logs`    | Displays the last 50 lines of PM2 logs   |
| `pm2:list`    | Lists PM2 processes                      |
| `pm2:stop`    | Stops applications                       |
| `pm2:restart` | Restarts applications                    |

```bash
node bin/cli.ts pm2:logs
node bin/cli.ts pm2:list --host staging
```

## Hooks

Hooks are global callbacks that run around the deployment, outside the pipeline.

```typescript
await defineConfig({
  // ...
  hooks: {
    async beforeDeploy({ hosts }) {
      console.log(`Deploying to ${hosts!.length} server(s)`)
    },

    async afterDeploy() {
      // notification, etc.
    },

    async beforeHostDeploy({ host }) {
      // enable maintenance mode
    },

    async afterHostDeploy({ host }) {
      // disable maintenance mode
    },
  },
})
```

| Hook               | When it runs                                              |
| ------------------ | --------------------------------------------------------- |
| `beforeDeploy`     | Before deploying to all hosts                             |
| `afterDeploy`      | After deploying to all hosts                              |
| `beforeHostDeploy` | Before the pipeline for each host                         |
| `afterHostDeploy`  | After the pipeline for each host (even on error)          |

## Server structure

After `deploy:setup`, the server will have the following structure:

```
/base/
  current/          → symlink to releases/<release>
  releases/
    2024-01-15T.../ ← active release
    2024-01-14T.../
  shared/
    .env            (AdonisJS recipe)
    storage/        (AdonisJS recipe)
    logs/           (AdonisJS recipe)
    tmp/            (AdonisJS recipe)
  revisions.log
  deploy.lock       ← present during a deployment
```

## Automatic rollback

If a failure occurs after `deploy:publish`, an automatic rollback is triggered:
the previous release is restored and PM2 is reloaded if present in the pipeline.

## Multi-server

```typescript
hosts: [
  {
    name: 'staging',
    ssh: 'deploy@staging.example.com',
    deployPath: '/home/deploy/staging/myapp',
    branch: 'develop',
    healthcheckUrl: 'http://127.0.0.1:3333/health',
  },
  {
    name: 'production',
    ssh: 'deploy@prod.example.com',
    deployPath: '/home/deploy/prod/myapp',
    branch: 'main',
    healthcheckUrl: 'http://127.0.0.1:3333/health',
  },
],
```

Deployment runs sequentially on each host. To target a single host:

```bash
node bin/cli.ts deploy --host staging
```

## Inspiration

Inspired by [Deployer PHP](https://deployer.org) and [Capistrano](https://capistranorb.com).
