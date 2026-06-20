---
description: Build a Next.js application with the Catapult nextjs recipe.
---

# `recipes/nextjs`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/nextjs.ts)

```typescript
import '@catapultjs/deploy/recipes/nextjs'
```

This recipe runs the Next.js build on the server. It does not override `deploy:update_code`, so combine it with a transfer recipe such as `git` or `rsync`.

It is designed for Next.js standalone output. After `next build`, it symlinks `public` and `.next/static` into `.next/standalone/` when that directory exists.

See the [example Next.js project](https://github.com/catapultjs/deploy/tree/main/examples/nextjs) for a complete setup, or go directly to [deploy.ts](https://github.com/catapultjs/deploy/blob/main/examples/nextjs/deploy.ts).

**Tasks**

| Task           | Inserted              | Description                                                                  |
| -------------- | --------------------- | ---------------------------------------------------------------------------- |
| `deploy:build` | after `deploy:shared` | Overrides the built-in build task, runs `next build`, and prepares standalone |

The recipe runs the build command from `{{release_path}}/{{nextjs_path}}`.

**Configuration**

| Key               | Type       | Default               | Description                                      |
| ----------------- | ---------- | --------------------- | ------------------------------------------------ |
| `shared_files`    | `string[]` | `['.env']`            | Files symlinked from `shared/` into each release |
| `nextjs_path`     | `string`   | `''`                  | Sub-path to the Next.js app within the repository |
| `nextjs_out_path` | `string`   | `'.next/standalone/'` | Standalone output path receiving the symlinks    |
| `source_path`     | `string`   | `''`                  | Used as the default value for `nextjs_path`      |

```typescript
import { set } from '@catapultjs/deploy'

set('nextjs_path', 'apps/web')
import '@catapultjs/deploy/recipes/nextjs'
```

For standalone output, make sure your Next.js config enables it:

```typescript
const nextConfig = {
  output: 'standalone',
}

export default nextConfig
```
