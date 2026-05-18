---
description: Use Catapult hooks to run custom logic before or after a deployment, independently from the task pipeline.
---

# Hooks

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

Hooks are global callbacks that run around the deployment, outside the pipeline.

```typescript
export default defineConfig({
  // ...
  hooks: {
    async beforeDeploy({ hosts }) {
      console.log(`Deploying to ${hosts!.length} server(s)`)
    },

    async afterDeploy({ hosts }) {
      // runs after all hosts deployed successfully
    },

    async afterFailure({ hosts, error }) {
      console.log(`Deploy failed: ${error?.message}`)
    },

    async beforeHostDeploy({ host }) {
      // enable maintenance mode
    },

    async afterHostDeploy({ host }) {
      // disable maintenance mode
    },
  },
})
```

| Hook               | Context            | When it runs                                     |
| ------------------ | ------------------ | ------------------------------------------------ |
| `beforeDeploy`     | `{ hosts }`        | Before deploying to all hosts                    |
| `afterDeploy`      | `{ hosts }`        | After all hosts deployed successfully            |
| `afterFailure`     | `{ hosts, error }` | When a deployment fails                          |
| `beforeHostDeploy` | `{ host }`         | Before the pipeline for each host                |
| `afterHostDeploy`  | `{ host }`         | After the pipeline for each host (even on error) |
