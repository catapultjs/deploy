---
description: Show the current deployment pipeline in execution order.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `pipeline`

Prints the current deployment pipeline as an ordered table.

## Usage

```bash
npx cata pipeline [options]
```

## Options

| Option | Description |
| --- | --- |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata pipeline
npx cata pipeline -c deploy.production.ts
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/pipeline.webm" type="video/webm"></video>