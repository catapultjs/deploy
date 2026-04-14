---
description: Clone the repository and log revisions with the Catapult git recipe.
---

# `recipes/git`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/git.ts)

```typescript
import '@catapultjs/deploy/recipes/git'
```

**Tasks**

| Task                 | Inserted                  | Description                                                                          |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `git:check`          | after `deploy:lock`       | Verifies the branch exists on the remote                                             |
| `git:update`         | before `deploy:update_code` | Clones a bare mirror of the repository to `.catapult/repo`, or fetches if it already exists |
| `deploy:update_code` | —                         | Overrides the built-in task — clones or fetches from the local mirror into the build or release directory depending on `strategy` |

`branch` is required on each host. The `repository` is auto-detected from `git remote get-url origin` if not set in `defineConfig`.

The local mirror at `.catapult/repo` avoids re-cloning from the remote on every deployment — subsequent deploys perform a fast local clone.
