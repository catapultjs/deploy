---
description: Run a shell command on one or more servers over SSH.
---

# `run`

Executes the given shell command on the selected hosts through SSH.

## Usage

```bash
npx cata run "<command>" [options]
```

## Arguments

| Argument | Description |
| --- | --- |
| `<command>` | Shell command to run on the remote host |

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata run "pm2 list"
npx cata run "pm2 reload all" --host production
npx cata run "ls -lah current" -H staging
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/run.webm" type="video/webm"></video>