---
description: Build and deploy a static Next.js export with the Catapult nextjs_static recipe.
---

# `recipes/nextjs_static`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nextjs_static.ts)

```typescript
import '@catapultjs/deploy/recipes/nextjs_static'
```

This recipe runs `next build` locally before the remote deployment starts and sets `source_path` to `./out/.`, the default output directory for a static Next.js export.

By default, Catapult transfers `source_path` with SCP through the built-in `deploy:update_code` task. You can optionally import `rsync` if you prefer rsync-based transfers.

See the [example static Next.js project](https://github.com/catapultjs/deploy/tree/main/examples/nextjs_static) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/nextjs_static/deploy.ts).

**Tasks**

| Task           | Inserted             | Description                               |
| -------------- | -------------------- | ----------------------------------------- |
| `deploy:build` | before `deploy:lock` | Runs `next build` on the local machine    |

**Configuration**

| Key           | Type     | Default    | Description                                  |
| ------------- | -------- | ---------- | -------------------------------------------- |
| `source_path` | `string` | `'./out/.'` | Local static export directory to transfer    |

```typescript
import '@catapultjs/deploy/recipes/nextjs_static'
```

Optional rsync transfer:

```typescript
import '@catapultjs/deploy/recipes/nextjs_static'
import '@catapultjs/deploy/recipes/rsync'
```

For static export output, make sure your Next.js config enables it:

```typescript
const nextConfig = {
  output: 'export',
}

export default nextConfig
```
