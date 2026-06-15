---
description: Command reference for the Catapult CLI, with one page per command.
---

# CLI

Catapult exposes the `cata` CLI through `npx cata ...` after installation.

## Config loading

`version` and `init` work without a deploy config file.

All other commands load one of these files from the current directory by default:

- `deploy.ts`
- `deploy.config.ts`
- `deploy.js`
- `deploy.config.js`

Use `--config` or `-c` to point to a different file.

## Global options

| Option | Description |
| --- | --- |
| `--help` | Show the help for the current command |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |


## Host-aware commands

These commands support `--host <name>` / `-H <name>`:

- [`deploy:setup`](./deploy-setup)
- [`deploy`](./deploy)
- [`rollback`](./rollback)
- [`status`](./status)
- [`list:releases`](./list-releases)
- [`list:revisions`](./list-revisions)
- [`task`](./task)
- [`ssh`](./ssh)
- [`run`](./run)

Without `--host`, Catapult uses the only configured host or prompts you to select one or more hosts when several are available.

## Commands

| Command | Description | Notes |
| --- | --- | --- |
| [`version`](./version) | Show the installed Catapult version | No config required |
| [`init`](./init) | Create a starter deploy config file | No config required |
| [`deploy:setup`](./deploy-setup) | Create the remote directory structure | Alias: `setup` |
| [`deploy`](./deploy) | Run a deployment | Alias: `dep` |
| [`rollback`](./rollback) | Switch back to a previous release | `--interactive` to choose the release |
| [`status`](./status) | Inspect the current state of one or more servers | Includes release and lock info |
| [`list:releases`](./list-releases) | List releases on the target servers | Marks the current release |
| [`list:revisions`](./list-revisions) | Show the last 10 logged revisions | Reads `.catapult/revisions.log` |
| [`list:tasks`](./list-tasks) | List pipeline tasks and extra registered tasks | Config required |
| [`pipeline`](./pipeline) | Show the current deployment pipeline order | Config required |
| [`task`](./task) | Run a registered task on the current release | Requires an existing release |
| [`ssh`](./ssh) | Open an SSH shell in `deployPath` | Prompts for one host if needed |
| [`run`](./run) | Run a remote shell command over SSH | Quote the command string |

