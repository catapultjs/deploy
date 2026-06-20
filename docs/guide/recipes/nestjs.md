---
description: Build and deploy a NestJS application with the Catapult nestjs recipe.
---

# `recipes/nestjs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nestjs.ts)

```typescript
import '@catapultjs/deploy/recipes/nestjs'
```

This recipe runs the standard Node.js install and build tasks on the server for a NestJS application. It does not override `deploy:update_code`, so combine it with a transfer recipe such as `git` or `rsync`.

See the [example NestJS project](https://github.com/catapultjs/deploy/tree/main/examples/nestjs) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/nestjs/deploy.ts).

**Tasks**

| Task             | Inserted                   | Description                          |
| ---------------- | -------------------------- | ------------------------------------ |
| `deploy:install` | after `deploy:update_code` | Installs dependencies in the release |
| `deploy:build`   | after `deploy:install`     | Runs the package manager build script |

**Configuration**

| Key            | Type       | Default    | Description                                      |
| -------------- | ---------- | ---------- | ------------------------------------------------ |
| `shared_files` | `string[]` | `['.env']` | Files symlinked from `shared/` into each release |

```typescript
import '@catapultjs/deploy/recipes/git'
import '@catapultjs/deploy/recipes/nestjs'
import '@catapultjs/deploy/recipes/pm2'
```

The build task uses the default `deploy:build` implementation, which runs:

```bash
npm run build
```

The exact package manager command follows your Catapult `packageManager` configuration.

For PM2, use the compiled NestJS entry from the active release:

```javascript
const path = require('path')
const deployPath = '/home/deploy/myapp'

module.exports = {
  apps: [
    {
      name: 'nest',
      cwd: path.join(deployPath, 'current'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
    },
  ],
}
```
