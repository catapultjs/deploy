---
description: Build a static Nuxt site locally with the Catapult nuxt_static recipe.
---

# `recipes/nuxt_static`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nuxt_static.ts)

```typescript
import '@catapultjs/deploy/recipes/nuxt_static'
```

This recipe runs `nuxt generate` locally before deployment and sets `source_path` to `./.output/public/.`, the default output directory for generated Nuxt static files.

By default, Catapult transfers `source_path` with SCP through the built-in `deploy:update_code` task. You can optionally import `rsync` if you prefer rsync-based transfers.

See the [example static Nuxt project](https://github.com/catapultjs/deploy/tree/main/examples/nuxt) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/nuxt/deploy.static.ts).

**Tasks**

| Task           | Inserted             | Description                            |
| -------------- | -------------------- | -------------------------------------- |
| `deploy:build` | before `deploy:lock` | Runs `nuxt generate` locally           |

**Configuration**

| Key           | Type     | Default              | Description                                  |
| ------------- | -------- | -------------------- | -------------------------------------------- |
| `source_path` | `string` | `'./.output/public/.'` | Local generated output directory to transfer |

```typescript
import '@catapultjs/deploy/recipes/nuxt_static'
```

Optional rsync transfer:

```typescript
import '@catapultjs/deploy/recipes/nuxt_static'
import '@catapultjs/deploy/recipes/rsync'
```
