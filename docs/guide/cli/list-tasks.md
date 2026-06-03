---
description: List the current pipeline tasks and extra registered tasks.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `list:tasks`

Shows two task groups:

1. Tasks in the current deployment pipeline.
2. Extra registered tasks that are available but not part of the pipeline.

## Usage

```bash
npx cata list:tasks [options]
```

## Options

| Option | Description |
| --- | --- |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata list:tasks
npx cata list:tasks -c deploy.production.ts
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/list-tasks.webm" type="video/webm"></video>