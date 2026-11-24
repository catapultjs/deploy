---
description: Learn how to create custom Catapult recipes — reusable JavaScript or TypeScript modules that register tasks and insert them into the deployment pipeline.
---

# Creating a Recipe

A recipe is a regular JavaScript or TypeScript file that registers tasks and inserts them into the pipeline upon import.

## Basic structure

```typescript
import { task, cd, run, after } from '@catapultjs/deploy'

task('my-recipe:build', () => {
  cd('{{release_path}}')
  run('npm ci')
  run('npm run build')
})

after('deploy:update_code', 'my-recipe:build')
```

The task function receives a `ctx` argument with the current `host`, `paths`, `config`, `release`, and `logger`. Use it when you need to access host information or run raw SSH commands:

```typescript
import { task, after } from '@catapultjs/deploy'
import { ssh, q } from '@catapultjs/deploy/utils'

task('my-recipe:build', async ({ host, paths, release, logger }) => {
  await ssh(host, `set -e\ncd ${q(paths.release)}\nnpm run build`)
  logger.step(host.name, `build complete for ${release}`)
})

after('deploy:update_code', 'my-recipe:build')
```

Importing the file is enough to activate it:

```typescript
import './recipes/my-recipe'
```

## Setup hook

Use `onSetup()` to run server-side initialization during `cata deploy:setup`:

```typescript
import { onSetup } from '@catapultjs/deploy'
import { ssh, q, getPaths } from '@catapultjs/deploy/utils'

onSetup(async (ctx, host, logger) => {
  const paths = getPaths(host.deployPath, ctx.release)
  await ssh(
    host,
    `
    set -e
    mkdir -p ${q(paths.shared + '/storage')}
    if [ ! -f ${q(paths.shared + '/.env')} ]; then
      touch ${q(paths.shared + '/.env')}
    fi
  `
  )
  logger.step(host.name, 'shared directories ready')
})
```

## Overriding built-in tasks

Recipes can override built-in tasks by registering the same name. This is how official recipes such as `git`, `rsync`, `adonisjs`, and `astro` customize `deploy:update_code` or `deploy:build`.

```typescript
import { task } from '@catapultjs/deploy'

task('deploy:update_code', async ({ paths }) => {
  console.log(`sync to ${paths.release}`)
})
```

## Status hook

Use `onStatus()` to display additional information during `cata status`:

```typescript
import { onStatus } from '@catapultjs/deploy'
import { ssh } from '@catapultjs/deploy/utils'

onStatus(async (_ctx, host, logger) => {
  const { stdout } = await ssh(host, `set +e\nmy-service --version || true`)
  logger.log(`my-service ${stdout.trim() || 'unavailable'}`)
})
```

## Rollback hooks

A recipe that manages its own processes must restart them on rollback. Use `onBeforeRollback()` to refuse an unusable target before anything changes, and `onRollback()` to restart the restored release. Both run for manual and automatic rollbacks, and receive the target release in `ctx.release`:

```typescript
import { onBeforeRollback, onRollback } from '@catapultjs/deploy'
import { ssh, q, getPaths } from '@catapultjs/deploy/utils'

onBeforeRollback(async (ctx, host) => {
  const paths = getPaths(host.deployPath, ctx.release)
  await ssh(host, `set -e\n[ -x ${q(paths.release + '/bin/start')} ]`)
})

onRollback(async (ctx, host) => {
  const paths = getPaths(host.deployPath, ctx.release)
  await ssh(host, `set -e\n${q(paths.release + '/bin/start')}`)
})
```

## Streaming data to the server

`sshPipe(host, command, source)` runs a remote command and streams a Node.js `Readable` or async iterable into its stdin, without buffering the payload in memory. A source failure stops the transfer and is rethrown; a remote failure is thrown with its exit code and stderr. Add `set -o pipefail` when the command chains several programs, and verify the result on the server: the remote side cannot tell an interrupted transfer from the end of input.

```typescript
import { createReadStream } from 'node:fs'
import { task } from '@catapultjs/deploy'
import { sshPipe, q } from '@catapultjs/deploy/utils'

task('assets:upload', async ({ host, paths }) => {
  await sshPipe(
    host,
    `set -eo pipefail\ngzip -d | tar -x -C ${q(paths.release)}`,
    createReadStream('./assets.tar.gz')
  )
})
```

## Configuration: `set()` / `get()`

Expose configurable options via `set()` / `get()` so users can customize the recipe without modifying it:

```typescript
import { task, run, get } from '@catapultjs/deploy'

task('my-recipe:deploy', () => {
  const excludes = get<string[]>('my_recipe_excludes', [])
  run(`rsync --exclude=${excludes.join(' --exclude=')} ...`)
})
```

Users configure it in their `deploy.ts`:

```typescript
import { set } from '@catapultjs/deploy'
import './recipes/my-recipe'

set('my_recipe_excludes', ['.git', 'node_modules'])
```

## Binaries: `bin()`

Use `bin()` to resolve binary paths. It checks the current host's `bin` config first, then falls back to the binary name:

```typescript
import { task, cd, run, bin } from '@catapultjs/deploy'

task('my-recipe:build', () => {
  cd('{{release_path}}')
  run(`${bin('node')} my-script.js`)
})
```

Users configure the path per host in `deploy.ts`:

```typescript
hosts: [
  {
    name: 'production',
    ssh: 'deploy@example.com',
    deployPath: '/home/deploy/myapp',
    bin: {
      node: '/home/deploy/.nvm/versions/node/v22.14.0/bin/node',
      php: '/usr/bin/php8.2',
    },
  },
]
```

## Contributing a recipe

If your recipe could be useful to others, you're welcome to contribute it to the project.

Open a pull request on [GitHub](https://github.com/catapultjs/deploy) and add your recipe file to the `contrib/` directory.

## TypeScript: extending `TaskRegistry`

To get type-safe task names, extend the `TaskRegistry` interface:

```typescript
import type {} from '@catapultjs/deploy'

declare module '@catapultjs/deploy' {
  interface TaskRegistry {
    'my-recipe:build': true
    'my-recipe:deploy': true
  }
}
```

## Agent skill

The package ships a `catapultjs` skill that teaches this whole workflow (conventions, DSL, hooks, pipeline insertion) to Claude Code and any agent supporting the SKILL.md format. Copy it into your project to get assisted recipe writing:

```bash
mkdir -p .claude/skills
cp -r node_modules/@catapultjs/deploy/skills/catapultjs .claude/skills/
```

See the [Agent skill](/guide/agent-skills) page for details.
