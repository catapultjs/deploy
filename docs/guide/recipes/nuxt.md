---
description: Build or generate a Nuxt application with the Catapult nuxt recipe.
---

# `recipes/nuxt`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nuxt.ts)

```typescript
import '@catapultjs/deploy/recipes/nuxt'
```

This recipe runs the Nuxt build and generate tasks on the server. It does not override `deploy:update_code`, so combine it with a transfer recipe such as `git` or `rsync`.

See the [example Nuxt project](https://github.com/catapultjs/deploy/tree/main/examples/nuxt) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/nuxt/deploy.ts).

**Tasks**

| Task            | Inserted | Description                                             |
| --------------- | -------- | ------------------------------------------------------- |
| `deploy:build`  | —        | Overrides the built-in build task and runs `nuxt build` |
| `nuxt:generate` | —        | Runs `nuxt generate`                                    |

The recipe runs commands from `{{release_path}}/{{nuxt_path}}`.

**Configuration**

| Key            | Type       | Default    | Description                                      |
| -------------- | ---------- | ---------- | ------------------------------------------------ |
| `shared_files` | `string[]` | `['.env']` | Files symlinked from `shared/` into each release |
| `nuxt_path`    | `string`   | `''`       | Sub-path to the Nuxt app within the repository   |
| `source_path`  | `string`   | `''`       | Used as the default value for `nuxt_path`        |

```typescript
import { set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/nuxt'

set('nuxt_path', 'apps/web')
```

Run the static generation task manually:

```bash
npx cata task nuxt:generate
```

If you want to generate a static Nuxt site locally and deploy the generated files, follow the [static deployment example](https://github.com/catapultjs/deploy/blob/main/examples/nuxt/deploy.static.ts).
