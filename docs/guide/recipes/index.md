---
description: Drop-in Catapult recipes for Node.js, Bun, AdonisJS, PM2, git and rsync.
---

# Recipes

:::warning Alpha
`@catapultjs/deploy` is currently in alpha. Its API may change between minor releases until it reaches a stable version. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

Recipes are importable modules that register tasks and insert them into the pipeline automatically.

| Recipe                 | Description                             |
| ---------------------- | --------------------------------------- |
| [git](./git)           | Clone the repository and log revisions  |
| [rsync](./rsync)       | Transfer files via rsync                |
| [nodejs](./nodejs)     | Install dependencies and build          |
| [bun](./bun)           | Install dependencies and build with Bun |
| [adonisjs](./adonisjs) | AdonisJS-specific deployment steps      |
| [pm2](./pm2)           | Process management with PM2             |
