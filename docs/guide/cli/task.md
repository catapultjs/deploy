---
description: Run a registered task on the current release of one or more servers.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `task`

Runs a registered task against the current release on the selected hosts.

## Usage

```bash
npx cata task <task-name> [options]
```

## Arguments

| Argument | Description |
| --- | --- |
| `<task-name>` | Name of a registered task |

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `-v`, `-vv`, `-vvv` | Increase verbosity from normal to debug |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata list:tasks
npx cata task deploy:build
npx cata task deploy:unlock
npx cata task deploy:restart -H production
npx cata task deploy:healthcheck -vv
```

The command requires an existing current release on each target host.

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/task.webm" type="video/webm"></video>