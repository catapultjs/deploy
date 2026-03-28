# Creating a Recipe

A recipe is a regular TypeScript file that registers tasks and inserts them into the pipeline upon import.

## Basic structure

```typescript
import { task, cd, run, after } from '@jrmc/catapult'

task('my-recipe:build', () => {
  cd('{{release_path}}')
  run('npm ci')
  run('npm run build')
})

after('deploy:upload', 'my-recipe:build')
```

Importing the file is enough to activate it:

```typescript
import './recipes/my-recipe'
```

## Setup hook

Use `onSetup()` to run server-side initialization during `cata deploy:setup` (e.g. create shared directories):

```typescript
import { onSetup } from '@jrmc/catapult'
import { ssh, q, getPaths } from '@jrmc/catapult/utils'

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

## Configuration: set() / get()

Expose configurable options via `set()` / `get()` so users can customize the recipe without modifying it:

```typescript
import { task, run, get } from '@jrmc/catapult'

task('my-recipe:deploy', () => {
  const excludes = get<string[]>('my_recipe_excludes', [])
  run(`rsync --exclude=${excludes.join(' --exclude=')} ...`)
})
```

Users configure it in their `deploy.ts`:

```typescript
import { set } from '@jrmc/catapult'
import './recipes/my-recipe'

set('my_recipe_excludes', ['.git', 'node_modules'])
```

## Binaries: bin()

Use `bin()` to let users override binary paths (useful for nvm/fnm environments):

```typescript
import { task, cd, run, bin } from '@jrmc/catapult'

task('my-recipe:build', () => {
  cd('{{release_path}}')
  run(`${bin('node')} my-script.js`)
})
```

Users override the path via:

```typescript
import { set } from '@jrmc/catapult'

set('bin/node', '/home/deploy/.nvm/versions/node/v22.14.0/bin/node')
```

## TypeScript: extending TaskRegistry

To get type-safe task names, extend the `TaskRegistry` interface:

```typescript
import type {} from '@jrmc/catapult'

declare module '@jrmc/catapult' {
  interface TaskRegistry {
    'my-recipe:build': true
    'my-recipe:deploy': true
  }
}
```
