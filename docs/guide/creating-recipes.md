---
description: Learn how to create custom Catapult recipes — reusable TypeScript modules that register tasks and insert them into the deployment pipeline.
---

# Creating a Recipe

A recipe is a regular TypeScript file that registers tasks and inserts them into the pipeline upon import.

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

Importing the file is enough to activate it:

```typescript
import './recipes/my-recipe'
```

## Setup hook

Use `onSetup()` to run server-side initialization during `cata deploy:setup` (e.g. create shared directories):

```typescript
import { onSetup } from '@catapultjs/deploy'
import { ssh, q, getPaths } from '@catapultjs/deploy/utils'

onSetup(async (ctx, host) => {
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
})
```

## Status hook

Use `onStatus()` to display additional information during `cata status` (e.g. process manager version, queue state):

```typescript
import { onStatus } from '@catapultjs/deploy'
import { ssh } from '@catapultjs/deploy/utils'

onStatus(async (_ctx, host) => {
  const { stdout } = await ssh(host, `set +e\nmy-service --version || true`)
  console.log(`my-service ${stdout.trim() || 'unavailable'}`)
})
```

## Configuration: set() / get()

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

## Binaries: bin()

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

## TypeScript: extending TaskRegistry

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
