---
description: Validate a Catapult deploy configuration file.
---

# `config:validate`

Loads and initializes the deploy configuration, then exits without running deployment tasks or connecting to hosts.

Use it to catch configuration mistakes in CI or before deploying changes to `deploy.config.json`, `deploy.json`, `deploy.config.ts` or `deploy.config.js`.

It validates Catapult's configuration wiring, not the remote infrastructure.

## What it validates

The command checks that Catapult can resolve, load and initialize the config file:

- the config file exists, either auto-detected or passed with `--config`
- JSON files parse as strict JSON and match the published schema
- JSON recipes, store values, declarative tasks and pipeline controls are valid
- TypeScript and JavaScript config modules can be imported
- TypeScript and JavaScript configs default-export `defineConfig(...)`
- declared recipes and custom tasks register successfully
- pipeline changes point to registered tasks and leave a non-empty final pipeline
- Catapult can initialize the final `defineConfig()` context

## What it does not validate

The command does not open SSH connections and does not execute deployment tasks. It therefore does not check:

- SSH credentials or network access
- remote directories and permissions
- installed server binaries such as `node`, `npm`, `caddy` or `pm2`
- whether task commands will succeed during an actual deploy
- application build output, unless the config itself reads it while loading

Run `deploy:setup`, `status`, `pipeline`, `list:tasks` or a real `deploy` when you need to inspect server state or execution behavior.

## Usage

```bash
npx cata config:validate [options]
```

## Options

| Option                         | Description                        |
| ------------------------------ | ---------------------------------- |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |
| `--json`                       | Output result as JSON              |

## Examples

```bash
npx cata config:validate
npx cata config:validate -c deploy.production.json
npx cata config:validate --json
```

The command exits with code `0` when the configuration is valid and code `1` when it is not.

Successful JSON output:

```json
{
  "valid": true,
  "file": "/path/to/deploy.config.json"
}
```

Failed JSON output:

```json
{
  "valid": false,
  "file": "/path/to/deploy.config.json",
  "error": "Invalid JSON deploy config ..."
}
```
