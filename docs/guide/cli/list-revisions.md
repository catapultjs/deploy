---
description: Show the last 10 deployment revisions recorded on the target servers.
---

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
| `--json` | Output result as JSON |

With `--json`, all hosts are targeted by default (no interactive prompt) unless `--host` is provided, and results are aggregated into a single JSON document on stdout. Logs and errors are written to stderr.

## Examples

```bash
npx cata list:revisions
npx cata list:revisions -H production
npx cata list:revisions --json
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/list-revisions.webm" type="video/webm"></video>