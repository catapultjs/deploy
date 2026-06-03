---
description: Open an interactive SSH shell in the configured deploy directory.
---

:::warning Beta
`@catapultjs/deploy` is currently in beta. The API is stabilising, but some behavior and interfaces may still change before `1.0`. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

# `ssh`

Opens an interactive SSH session and changes into the host `deployPath` before starting the shell.

## Usage

```bash
npx cata ssh [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata ssh
npx cata ssh --host production
```

When several hosts are configured and `--host` is omitted, Catapult prompts you to choose a single host.

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/ssh.webm" type="video/webm"></video>