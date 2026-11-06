---
description: Build an Astro application on the server with the Catapult astro recipe.
---

# `recipes/astro`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/astro.ts)

```typescript
import '@catapultjs/deploy/recipes/astro'
```

This recipe runs the Astro build on the server. It does not override `deploy:update_code`, so it uses core SCP by default. Import `git` or `rsync` if you want a different transfer.

See the [example Astro project](https://github.com/catapultjs/deploy/tree/main/examples/astro) for a complete setup, or go directly to [deploy.js](https://github.com/catapultjs/deploy/blob/main/examples/astro/deploy.js).

**Tasks**

| Task             | Inserted                   | Description                                            |
| ---------------- | -------------------------- | ------------------------------------------------------ |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release                   |
| `deploy:build`   | after `deploy:shared`      | Overrides the built-in build task and runs `astro build` |

The recipe runs the build command from `{{release_path}}/{{astro_path}}`.

**Configuration**

| Key           | Type     | Default | Description                                    |
| ------------- | -------- | ------- | ---------------------------------------------- |
| `astro_path`  | `string` | `''`    | Sub-path to the Astro app within the repository |
| `source_path` | `string` | `''`    | Used as the default value for `astro_path`      |

```typescript
import { set } from '@catapultjs/deploy'

import '@catapultjs/deploy/recipes/astro'

set('astro_path', 'apps/web')
```

For standalone server output, make sure your Astro config uses the Node adapter in standalone mode:

```typescript
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  adapter: node({
    mode: 'standalone',
  }),
})
```

For static Astro sites built locally, use [`recipes/astro_static`](./astro_static).
