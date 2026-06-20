---
description: Build and deploy a TanStack Start application with the Catapult tanstack recipe.
---

# `recipes/tanstack`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/tanstack.ts)

```typescript
import '@catapultjs/deploy/recipes/tanstack'
```

This recipe runs the standard Node.js install and build tasks on the server for a TanStack Start application. It does not override `deploy:update_code`, so combine it with a transfer recipe such as `git` or `rsync`.

TanStack Start supports Vite builds through Nitro. For a Node.js server deployment, configure Nitro in `vite.config.ts` with the `node-server` preset, then run the generated server output on the target host.

See the [example TanStack Start project](https://github.com/catapultjs/deploy/tree/main/examples/tanstack) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/tanstack/deploy.ts).

**Tasks**

| Task             | Inserted                   | Description                           |
| ---------------- | -------------------------- | ------------------------------------- |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release  |
| `deploy:build`   | after `deploy:install`     | Runs the package manager build script |

**Configuration**

| Key            | Type       | Default    | Description                                      |
| -------------- | ---------- | ---------- | ------------------------------------------------ |
| `shared_files` | `string[]` | `['.env']` | Files symlinked from `shared/` into each release |

**Vite + Nitro**

Install Nitro:

```bash
npm install nitro
```

Configure `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({ preset: 'node-server' }),
    viteReact(),
  ],
})
```

Use package scripts that build with Vite and start the Nitro output:

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

For PM2, use the generated server entry and pass the host/port environment variables explicitly:

```javascript
module.exports = {
  apps: [
    {
      name: 'tanstack',
      cwd: '/home/deploy/myapp/current',
      script: '.output/server/index.mjs',
    },
  ],
}
```

See TanStack's [Node.js / Docker hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nodejs--docker) for the upstream hosting details.
