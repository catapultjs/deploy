---
description: Show the last 10 deployment revisions recorded on the target servers.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `list:revisions`

Reads `.catapult/revisions.log` on the selected hosts and renders the last 10 revisions as a table with release, branch, commit, author, and date.

## Usage

```bash
npx cata list:revisions [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata list:revisions
npx cata list:revisions -H production
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/list-revisions.webm" type="video/webm"></video>