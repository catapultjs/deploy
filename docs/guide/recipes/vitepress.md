---
description: Build a VitePress site locally and upload the generated files with the Catapult vitepress recipe.
---

# `recipes/vitepress`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/vitepress.ts)

```typescript
import '@catapultjs/deploy/recipes/vitepress'
```

**Tasks**

| Task                 | Inserted             | Description                                                                                               |
| -------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `deploy:build`       | before `deploy:lock` | Runs `vitepress build <vitepress_path>` on the local machine                                              |
| `deploy:update_code` | —                    | Overrides the built-in task and uploads `<vitepress_path>.vitepress/dist` to `releases/<release>` via SCP |

**Configuration**

| Key              | Type     | Default | Description                                                                                          |
| ---------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `vitepress_path` | `string` | `''`    | Path passed to `vitepress build`. The uploaded output is read from `<vitepress_path>.vitepress/dist` |
| `source_path`    | `string` | `''`    | Used as the default value for `vitepress_path`                                                       |

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/vitepress'

set('vitepress_path', 'docs/')

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/docs',
    },
  ],
})
```
