# Catapult CLI reference

The CLI is `cata`, invoked via `npx cata <command>`. Full docs: https://catapultjs.com/guide/cli

## Config loading

`version` and `init` work without a config file. All other commands load `deploy.ts`, `deploy.config.ts`, `deploy.js`, or `deploy.config.js` from the current directory, or use `--config <path>` / `-c <path>` to specify another file.

## Global options

| Option | Description |
| --- | --- |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |
| `--host <name>`, `-H <name>` | Target a specific host (available on all host-aware commands) |
| `--help` | Show help for the current command |

## Commands

### `deploy:setup` (alias: `setup`)

Creates the remote directory structure and runs recipe setup hooks. Must be run once before the first deploy.

```bash
npx cata deploy:setup
npx cata setup --host production
npx cata setup -H staging
```

### `deploy` (alias: `dep`)

Runs the full deployment pipeline. Prompts to run `deploy:setup` if the host is not initialized.

| Option | Description |
| --- | --- |
| `--branch <name>`, `-b <name>` | Override the branch for this deployment |
| `-v`, `-vv`, `-vvv` | Increase verbosity |

```bash
npx cata deploy
npx cata deploy --host production
npx cata deploy --branch feature/my-feature
npx cata dep -H staging -b develop
npx cata deploy --config deploy.staging.ts
```

### `rollback`

Restores the previous release. With `--interactive`, prompts to choose the target release. Automatic rollback also triggers after a failure past `deploy:publish`.

| Option | Description |
| --- | --- |
| `--interactive`, `-i` | Choose the target release interactively |

```bash
npx cata rollback
npx cata rollback --interactive
npx cata rollback -i -H production
```

### `status`

Shows current release, healthcheck, runtime versions, revision metadata, and lock state. With `--json`, targets all hosts by default and writes aggregated JSON to stdout (errors to stderr).

| Option | Description |
| --- | --- |
| `--json` | Output result as JSON |

```bash
npx cata status
npx cata status --host production
npx cata status --json
```

### `task <task-name>`

Runs a registered task against the current release. Requires an existing release on each target host. Use `list:tasks` first to see available task names.

| Option | Description |
| --- | --- |
| `-v`, `-vv`, `-vvv` | Increase verbosity |

```bash
npx cata list:tasks
npx cata task deploy:build
npx cata task deploy:unlock
npx cata task deploy:restart -H production
npx cata task deploy:healthcheck -vv
```

### `run "<command>"`

Executes a shell command on the selected hosts over SSH. Quote the command string.

```bash
npx cata run "pm2 list"
npx cata run "pm2 reload all" --host production
npx cata run "ls -lah current" -H staging
```

### `ssh`

Opens an interactive SSH session in `deployPath` on the selected host. Prompts to choose when several hosts are configured and `--host` is omitted.

```bash
npx cata ssh
npx cata ssh --host production
```

### `list:releases`

Lists all releases on the target hosts, marking the current one.

```bash
npx cata list:releases
npx cata list:releases --host production
npx cata list:releases --json
```

### `list:revisions`

Shows the last 10 logged revisions from `.catapult/revisions.log`.

```bash
npx cata list:revisions
npx cata list:revisions --host production
npx cata list:revisions --json
```

### `list:tasks`

Lists all pipeline tasks and extra registered tasks from the loaded config.

```bash
npx cata list:tasks
```

### `pipeline`

Shows the current deployment pipeline task order.

```bash
npx cata pipeline
npx cata pipeline --json
```

### `init`

Generates a starter `deploy.ts` in the current directory. No config required.

```bash
npx cata init
```

### `version`

Prints the installed `@catapultjs/deploy` version. No config required.

```bash
npx cata version
```
