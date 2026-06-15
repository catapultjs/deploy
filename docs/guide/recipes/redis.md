---
description: Flush one, many, or all Redis databases with the Catapult redis recipe.
---

# `recipes/redis`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/redis.ts)

```typescript
import '@catapultjs/deploy/recipes/redis'
```

**Tasks**

| Task                 | Inserted | Description                                        |
| -------------------- | -------- | -------------------------------------------------- |
| `redis:db:flush`     | —        | Flushes the configured Redis database or databases |
| `redis:db:flush_all` | —        | Runs `redis-cli FLUSHALL`                          |

**Configuration**

| Key        | Type                 | Default | Description                                                                  |
| ---------- | -------------------- | ------- | ---------------------------------------------------------------------------- |
| `redis_db` | `number \| number[]` | `1`     | Redis DB index used by `redis:db:flush`. Pass an array to flush multiple DBs |

Use a single Redis DB:

```typescript
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/redis'

set('redis_db', 1)

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

Flush multiple Redis DBs with the same task:

```typescript
set('redis_db', [0, 1, 2])
```

Run the tasks manually from the terminal:

```bash
npx cata task redis:db:flush
npx cata task redis:db:flush_all --host staging
```
