---
description: Clone the repository and log revisions with the Catapult git recipe.
---

# `recipes/git`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/git.ts)

```typescript
import '@catapultjs/deploy/recipes/git'
```

**Tasks**

| Task                  | Inserted             | Description                                        |
| --------------------- | -------------------- | -------------------------------------------------- |
| `git:check`           | after `deploy:lock`  | Verifies the branch exists on the remote           |
| `deploy:update_code`  | —                    | Overrides the built-in task to clone via git       |
| `deploy:log_revision` | —                    | Overrides the built-in task to log branch + commit |

`branch` is required on each host. The `repository` is auto-detected from `git remote get-url origin` if not set in `defineConfig`.
