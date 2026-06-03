---
description: Roll back to the previous release or choose a specific release interactively.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `rollback`

Restores the previous release by default. With interactive mode enabled, Catapult lets you choose the target release.

## Usage

```bash
npx cata rollback [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--interactive`, `-i` | Prompt for the target release instead of using the previous one |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |


## Automatic rollback

If a failure occurs after `deploy:publish`, an automatic rollback is triggered:
the previous release is restored and PM2 is reloaded if present in the pipeline.


## Examples

```bash
npx cata rollback
npx cata rollback --interactive
npx cata rollback -i -H production
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/rollback.webm" type="video/webm"></video>

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/rollback-i.webm" type="video/webm"></video>