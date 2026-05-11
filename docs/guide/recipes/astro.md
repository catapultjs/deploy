---
description: Build an Astro application on your local machine, then upload the generated artifacts with the Catapult astro recipe.
---

# `recipes/astro`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/astro.ts)

```typescript
import '@catapultjs/deploy/recipes/astro'
```

This recipe builds the Astro application locally before deployment, then uploads the generated files to the target server. The remote host receives the built output from `source_path`; it does not run `astro build` itself.

See the [example Astro project](https://github.com/catapultjs/deploy/tree/main/examples/astro) for a complete setup, or go directly to [deploy.js](https://github.com/catapultjs/deploy/blob/main/examples/astro/deploy.js).

**Tasks**

| Task                 | Inserted             | Description |
| -------------------- | -------------------- | ----------- |
| `deploy:build`       | before `deploy:lock` | Runs `astro build --mode <astro_mode>` on the local machine |
| `deploy:update_code` | —                    | Overrides the built-in task and uploads the generated directory to `releases/<release>` via SCP |

**Configuration**

| Key           | Type                              | Default        | Description |
| ------------- | --------------------------------- | -------------- | ----------- |
| `astro_mode`  | `string \| Record<string, string>` | `'production'` | Astro build mode. Can be set globally or per host |
| `source_path` | `string`                          | `'./dist/.'`     | Directory uploaded after the local build |

`astro_mode` is passed directly to `astro build --mode ...`. This controls which Astro environment files are loaded during the build. For example, `production` loads the production environment, while `staging` lets you build with a dedicated `.env.staging` file.

If you use environment-specific variables, choose an `astro_mode` that matches your Astro setup. See [Setting environment variables](https://docs.astro.build/en/guides/environment-variables/#setting-environment-variables) in the Astro documentation for the supported file names and loading rules.

Use a single mode for all hosts:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/astro'

set('astro_mode', 'production')
// set('source_path', './dist/.')

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

In the object form, each key must match a Catapult host `name`, and each value is the Astro mode used when deploying that host.

| Host `name`  | `astro_mode` value | Build command |
| ------------ | ------------------ | ------------- |
| `production` | `production`       | `astro build --mode production` |
| `staging`    | `staging`          | `astro build --mode staging` |

This means Catapult selects the mode from the current host name before running the local Astro build.

If you want to keep the local Astro build but replace the default SCP upload with `rsync`, import the `astro` and `rsync` recipes together. In that setup, `astro` still provides `deploy:build`, and `rsync` overrides `deploy:update_code`.

```typescript
import '@catapultjs/deploy/recipes/astro'
import '@catapultjs/deploy/recipes/rsync'
```

This should not be combined with the `git` recipe. The purpose of `astro` recipe is to build the project locally and deploy the generated artifacts, whereas `git` deploys the repository itself and expects the application to be built from the checked-out source on the server.
