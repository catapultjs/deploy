---
description: Learn how to create custom Catapult recipes — reusable JavaScript or TypeScript modules that register tasks and insert them into the deployment pipeline.
---

# Creating a Recipe

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

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
