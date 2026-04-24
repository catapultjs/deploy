---
description: Catapult changelog — release history and notable changes.
---

# Changelog

## 0.5.0

- `rollback` command now accepts `--interactive` / `-i` flag — lists available releases and prompts for selection, with the current release marked and disabled
- `--host` flag now has a `-H` short alias — available on all commands
- `--branch` flag on `deploy` now has a `-b` short alias
- Added `local(command, options?)` to the task DSL — executes a shell command on the local machine, with optional `cwd`; flushes queued SSH commands first
- Fixed `upload()` and `download()` not interpolating template variables (e.g. `{{release_path}}`) in `remotePath`

> Released at *2026-04-24*

## 0.4.0

- Added `Verbose.TRACE` level (`2`) between `NORMAL` and `DEBUG` — `NORMAL` now only shows task progress, `TRACE` shows SSH commands, `DEBUG` streams stdout; existing indices shifted (`DEBUG` is now `3`)
- `Verbose.SILENT` (`0`) no longer displays anything — task progress previously shown at `SILENT` is now gated at `NORMAL`
- CLI flags extended: `-vvv` sets `Verbose.DEBUG` (level 3); `-v` → `NORMAL`, `-vv` → `TRACE`
- `isVerbose()` signature changed: now takes a `Verbose` level and returns `boolean` — e.g. `isVerbose(Verbose.TRACE)`
- Added `upload(localPath, remotePath)` and `download(remotePath, localPath)` to the task DSL — transfer files via SCP, reusing the SSH multiplexing socket
- `upload()` and `download()` now resolve relative `remotePath` values against `host.deployPath`

> Released at *2026-04-23*

## 0.3.0

- Added `list:revisions` command — displays the last 10 deployments from `.catapult/revisions.log` in a table (release, branch, commit, author, date)
- `ssh` command now opens the session directly in `deployPath` instead of the home directory
- Removed `--ansi` global flag — it only affected Ace's UI components, not the deploy logger, so it was misleading
- Added `Verbose` enum (`Verbose.SILENT`, `Verbose.NORMAL`, `Verbose.DEBUG`) — replaces the raw `0 | 1 | 2` type for the `verbose` config option; available via `@catapultjs/deploy/enums`
- Added `@catapultjs/deploy/enums` export — exposes `Strategy`, `PackageManager` and `Verbose`

> Released at *2026-04-17*

## 0.2.0

- Added `catapult/types` export — types can now be imported directly from `catapult/types`
- `recipes/adonisjs`: `adonisjs:migrate` now runs before `deploy:publish` regardless of the active strategy — replaces the previous `hasTask` conditional that placed it after `deploy:build:copy` or `adonisjs:build`
- Fixed: `adonisjs:migrate` now passes `--force` to `ace migration:run`, which is required in non-interactive deployment environments
- Fixed: default `strategy` was incorrectly falling back to `Strategy.BUILD` instead of `Strategy.DIRECT` when not set in `defineConfig`

> Released at *2026-04-15*

## 0.1.0

- Added `Strategy` enum (`Strategy.BUILD` | `Strategy.DIRECT`) — controls where install/build tasks run before being copied to the release
- Added `strategy` option to `defineConfig` (default: `Strategy.DIRECT`) — when set to `Strategy.BUILD`, two new tasks are inserted into the pipeline: `deploy:build:shared` (symlinks shared paths into the build directory) and `deploy:build:copy` (copies build output into the release)
- Added `{{builder_path}}` template variable — resolves to `{deployPath}/.catapult/builder`
- Added `git:update` task in `recipes/git` — maintains a cached bare mirror of the repository on the server; `deploy:update_code` now clones from this local mirror instead of the remote
- `TaskContext`: replaced `deployCtx` with two top-level fields — `config` (the resolved config object) and `release` (the release name string)
- `deploy:log_revision` now writes structured JSON to `.catapult/revisions.log` instead of a plain text line in `revisions.log`
- `cata status` now displays the last deployment revision (branch, commit, author, date) when available
- Renamed CLI command `list:pipeline` → `pipeline`
- Server paths reorganised under `.catapult/` — `deploy.lock` is now at `.catapult/deploy.lock`, and new paths `repo` (`.catapult/repo`) and `builder` (`.catapult/builder`) are exposed on `TaskContext.paths`
- `paths.cataConfig` added — resolves to `{deployPath}/.catapult`
- Added `has(key)` to the store — returns `true` if the key is set
- `recipes/pm2`: removed `pm2:ecosystem` task — `ecosystem.config.cjs` is now read directly from the release path; renamed `pm2:start` → `pm2:startOrReload` (starts or reloads); added a new `pm2:start` task that only starts processes
- `recipes/nodejs`, `recipes/bun`: tasks now operate on `{{builder_path}}` when `strategy` is `Build`; pipeline positions updated (`nodejs:install`/`bun:install` after `deploy:update_code`, build task after `deploy:build:shared`)
- `recipes/adonisjs`: tasks are now strategy-aware; `adonisjs:migrate` is inserted after `deploy:build:copy` when using the Build strategy

> Released at *2026-04-15*

## 0.0.6

- Added `run` command — executes a shell command on one or more hosts via SSH (`npx cata run "pm2 list"`)
- Added `desc(description)` function — sets a description for the next `task()` call, displayed in `cata list:tasks`
- Added `afterFailure` hook — called when a deployment fails, receives `{ hosts, error }`
- `packageManager` is now auto-detected from lock files (`bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`) if not set in `defineConfig`
- `recipes/pm2`: added `pm2:delete` task — deletes all processes from PM2

> Released at *2026-04-11*

## 0.0.5

- Added `recipes/nodejs` — registers `nodejs:install`, `nodejs:install:production`, `nodejs:build` and `nodejs:test` tasks, inserted automatically after `deploy:shared`
- Added `recipes/bun` — same tasks prefixed with `bun:`, for Bun-based projects
- `packageManager` is now a `defineConfig` option (`'npm' | 'pnpm' | 'yarn' | 'bun'`, default `'npm'`) instead of a store key — `pm()`, `pmInstall()` and `pmInstallProd()` read from config
- `pmInstall()` and `pmInstallProd()` now handle `bun` (`bun install --frozen-lockfile`, `bun install --production`)
- `healthcheckUrl`, `healthcheckRetries` and `healthcheckDelayMs` replaced by a `healthcheck` object on each `Host` (`{ url?, retries?, delayMs? }`) — allows per-host healthcheck configuration
- `keepReleases` is now optional in `defineConfig` (default: `5`)

> Released at *2026-04-10*

## 0.0.4

- `defineConfig` now returns a function and must be used as `export default defineConfig({...})` — the CLI calls it explicitly, giving full control over execution order
- Added a `logger` instance to `TaskContext`, `onStatus()` and `onSetup()` callbacks — no more direct imports needed inside tasks and recipes
- `ssh()` now accepts a `{ color: true }` option that prepends `export FORCE_COLOR=1` to the remote command, enabling colored output from tools like PM2
- `recipes/pm2`: added `pm2:show` task — displays detailed PM2 process info for each app defined in `ecosystem.config.cjs`
- `recipes/pm2`: `pm2:logs` and `pm2:list` now use `{ color: true }` for colored terminal output
- `task` command now accepts `-v` / `-vv` verbose flags (consistent with `deploy`)
- Fixed: `deploy:unlock` is no longer called when `deploy:lock` itself fails — a lock held by another deployment is no longer removed on error

> Released at *2026-04-09*

## 0.0.3

- `verbose` config option changed from `boolean` to `0 | 1 | 2`: level `1` prints SSH commands, level `2` also streams stdout
- Added `--verbose` / `-v` and `-vv` CLI flags on the `deploy` command to override the config verbosity at runtime
- `recipes/pm2`: added `pm2:ecosystem` task — symlinks `ecosystem.config.cjs` from the release into the base deploy path so PM2 always references a stable path
- `recipes/pm2`: `pm2:start` and `pm2:save` refactored to use `cd()`/`run()` DSL
- `deploy:shared`: leading slashes are now stripped from `shared_dirs` and `shared_files` entries to prevent double slashes in paths

> Released at *2026-04-08*

## 0.0.2

- `deploy:healthcheck` is now automatically removed from the pipeline when no host defines a `healthcheckUrl`
- Added `detectPackageManager` — the `cata init` and `cata status` commands now auto-detect the package manager from lock files
- Internal refactoring: task runner and store split into dedicated classes
- Added unit tests

> Released at *2026-04-05*

## 0.0.1

Initial release.

- SSH deployment pipeline with `deploy:lock`, `deploy:release`, `deploy:update_code`, `deploy:shared`, `deploy:publish`, `deploy:log_revision`, `deploy:healthcheck`, `deploy:unlock`, `deploy:cleanup`
- Built-in recipes: `git`, `rsync`, `adonisjs`, `pm2`
- Commands: `deploy`, `deploy:setup`, `rollback`, `status`, `task`, `ssh`, `list:pipeline`, `list:tasks`, `list:releases`, `init`, `version`
- `before()`, `after()`, `remove()`, `setPipeline()` for pipeline customisation
- `set()` / `get()` store for recipe configuration
- `pm()`, `pmInstall()`, `pmInstallProd()` package manager helpers
- `onSetup()` and `onStatus()` lifecycle hooks
- Automatic rollback on deployment failure
- Multi-server support with host selection prompt
- `--host` and `--branch` CLI flags

> Released at *2026-04-03*
