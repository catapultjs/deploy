---
description: List releases available on the selected servers.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `list:releases`

Lists release directories on the target hosts and marks the current release with `*`.

## Usage

```bash
npx cata list:releases [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |
| `--json` | Output result as JSON |

With `--json`, all hosts are targeted by default (no interactive prompt) unless `--host` is provided, and results are aggregated into a single JSON document on stdout. Logs and errors are written to stderr.

## Examples

```bash
npx cata list:releases
npx cata list:releases --host production
npx cata list:releases --json
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/list-releases.webm" type="video/webm"></video>