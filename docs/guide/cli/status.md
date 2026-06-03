---
description: Inspect the state of one or more target servers.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `status`

Shows the current release, healthcheck result, runtime versions, revision metadata, and deployment lock state for the selected hosts.

## Usage

```bash
npx cata status [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata status
npx cata status --host production
npx cata status -c deploy.staging.ts
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/status.webm" type="video/webm"></video>
