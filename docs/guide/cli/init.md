---
description: Create a starter deploy config file and install Catapult.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `init`

Creates a starter `deploy.ts` or `deploy.js` file, then installs `@catapultjs/deploy` as a dev dependency with the detected package manager.

## Usage

```bash
npx @catapultjs/deploy init
```

## What it does

1. Prompts you to choose TypeScript or JavaScript.
2. Creates `deploy.ts` or `deploy.js` in the current directory.
3. Installs `@catapultjs/deploy` with the detected package manager.

## Examples

```bash
npx @catapultjs/deploy init
```

This command does not require a deploy config file.

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/init.webm" type="video/webm"></video>