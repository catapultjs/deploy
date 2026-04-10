---
description: Catapult changelog — release history and notable changes.
---

# Changelog

## 0.0.5

- Added `recipes/nodejs` — registers `nodejs:install`, `nodejs:install:production`, `nodejs:build` and `nodejs:test` tasks, inserted automatically after `deploy:shared`
- Added `recipes/bun` — same tasks prefixed with `bun:`, for Bun-based projects
- `packageManager` is now a `defineConfig` option (`'npm' | 'pnpm' | 'yarn' | 'bun'`, default `'npm'`) instead of a store key — `pm()`, `pmInstall()` and `pmInstallProd()` read from config
- `pmInstall()` and `pmInstallProd()` now handle `bun` (`bun install --frozen-lockfile`, `bun install --production`)
- `healthcheckUrl`, `healthcheckRetries` and `healthcheckDelayMs` replaced by a `healthcheck` object on each `Host` (`{ url?, retries?, delayMs? }`) — allows per-host healthcheck configuration
- `keepReleases` is now optional in `defineConfig` (default: `5`)

## 0.0.4

- `defineConfig` now returns a function and must be used as `export default defineConfig({...})` — the CLI calls it explicitly, giving full control over execution order
- Added a `logger` instance to `TaskContext`, `onStatus()` and `onSetup()` callbacks — no more direct imports needed inside tasks and recipes
- `ssh()` now accepts a `{ color: true }` option that prepends `export FORCE_COLOR=1` to the remote command, enabling colored output from tools like PM2
- `recipes/pm2`: added `pm2:show` task — displays detailed PM2 process info for each app defined in `ecosystem.config.cjs`
- `recipes/pm2`: `pm2:logs` and `pm2:list` now use `{ color: true }` for colored terminal output
- `task` command now accepts `-v` / `-vv` verbose flags (consistent with `deploy`)
- Fixed: `deploy:unlock` is no longer called when `deploy:lock` itself fails — a lock held by another deployment is no longer removed on error

## 0.0.3

- `verbose` config option changed from `boolean` to `0 | 1 | 2`: level `1` prints SSH commands, level `2` also streams stdout
- Added `--verbose` / `-v` and `-vv` CLI flags on the `deploy` command to override the config verbosity at runtime
- `recipes/pm2`: added `pm2:ecosystem` task — symlinks `ecosystem.config.cjs` from the release into the base deploy path so PM2 always references a stable path
- `recipes/pm2`: `pm2:start` and `pm2:save` refactored to use `cd()`/`run()` DSL
- `deploy:shared`: leading slashes are now stripped from `shared_dirs` and `shared_files` entries to prevent double slashes in paths

## 0.0.2

- `deploy:healthcheck` is now automatically removed from the pipeline when no host defines a `healthcheckUrl`
- Added `detectPackageManager` — the `cata init` and `cata status` commands now auto-detect the package manager from lock files
- Internal refactoring: task runner and store split into dedicated classes
- Added unit tests

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
