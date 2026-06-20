---
description: Build a static Astro site locally with the Catapult astro_static recipe.
---

# `recipes/astro_static`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/astro_static.ts)

```typescript
import '@catapultjs/deploy/recipes/astro_static'
```

This recipe builds the Astro application locally before deployment and sets `source_path` to `./dist/.`, the default Astro output directory.

By default, Catapult transfers `source_path` with SCP through the built-in `deploy:update_code` task. You can optionally import `rsync` if you prefer rsync-based transfers.

See the [example static Astro project](https://github.com/catapultjs/deploy/tree/main/examples/astro) for a complete setup, or go directly to [deploy.js](https://github.com/catapultjs/deploy/blob/main/examples/astro/deploy.static.js).

**Tasks**

| Task           | Inserted             | Description                                             |
| -------------- | -------------------- | ------------------------------------------------------- |
| `deploy:build` | before `deploy:lock` | Runs `astro build --mode <astro_mode>` locally          |

**Configuration**

| Key           | Type                               | Default        | Description                                            |
| ------------- | ---------------------------------- | -------------- | ------------------------------------------------------ |
| `astro_mode`  | `string \| Record<string, string>` | `'production'` | Astro build mode. Can be set globally or per host      |
| `source_path` | `string`                           | `'./dist/.'`   | Local build output directory to transfer               |

`astro_mode` is passed directly to `astro build --mode ...`. This controls which Astro environment files are loaded during the build.

Use a single mode for all hosts:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'

set('astro_mode', 'production')
import '@catapultjs/deploy/recipes/astro_static'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
    },
  ],
})
```

Or define a different mode per host:

```typescript
set('astro_mode', {
  production: 'production',
  staging: 'staging',
})
```

Optional rsync transfer:

```typescript
import '@catapultjs/deploy/recipes/astro_static'
import '@catapultjs/deploy/recipes/rsync'
```

This should not be combined with the `git` recipe. The purpose of `astro_static` is to build the project locally and deploy the generated artifacts, whereas `git` deploys the repository itself and expects the application to be built from the checked-out source on the server.
