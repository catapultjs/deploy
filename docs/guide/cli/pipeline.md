---
description: Show the current deployment pipeline in execution order.
---

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
| `--json` | Output result as JSON |

## Examples

```bash
npx cata pipeline
npx cata pipeline -c deploy.production.ts
npx cata pipeline --json
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/pipeline.webm" type="video/webm"></video>