---
description: Clone the repository and log revisions with the Catapult git recipe.
---

# `recipes/git`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/git.ts)

```typescript
import '@catapultjs/deploy/recipes/git'
```

`branch` is required on each host. The `repository` is auto-detected from `git remote get-url origin` if not set in `defineConfig`.

**Tasks**

| Task                 | Inserted                    | Description |
| -------------------- | --------------------------- | ----------- |
| `git:check`          | after `deploy:lock`         | Verifies the configured branch exists on the remote repository |
| `git:update`         | before `deploy:update_code` | Clones a bare mirror into `.catapult/repo`, or fetches it if it already exists |
| `deploy:update_code` | —                           | Overrides the built-in task and clones or fetches the requested branch into `releases/<release>` |

The local mirror at `.catapult/repo` avoids re-cloning from the remote on every deployment. Subsequent deploys fetch the mirror, then clone or reset the release from that local cache.
