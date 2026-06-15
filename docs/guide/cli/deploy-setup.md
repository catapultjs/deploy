---
description: Initialize the Catapult directory structure on one or more servers.
---

# `deploy:setup`

Creates the remote directories Catapult needs before the first deployment and runs setup hooks registered by recipes.

Alias: `setup`

## Usage

```bash
npx cata deploy:setup [options]
npx cata setup [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata deploy:setup
npx cata deploy:setup --host production
npx cata setup -H staging
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/setup.webm" type="video/webm"></video>
