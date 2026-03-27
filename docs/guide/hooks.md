# Hooks

Hooks are global callbacks that run around the deployment, outside the pipeline.

```typescript
await defineConfig({
  // ...
  hooks: {
    async beforeDeploy({ hosts }) {
      console.log(`Deploying to ${hosts!.length} server(s)`)
    },

    async afterDeploy() {
      // notification, etc.
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

| Hook               | When it runs                                              |
| ------------------ | --------------------------------------------------------- |
| `beforeDeploy`     | Before deploying to all hosts                             |
| `afterDeploy`      | After deploying to all hosts                              |
| `beforeHostDeploy` | Before the pipeline for each host                         |
| `afterHostDeploy`  | After the pipeline for each host (even on error)          |
