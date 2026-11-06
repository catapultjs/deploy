---
description: Roll back to the previous release or choose a specific release interactively.
---

# `rollback`

Restores the target of the `previous` symlink recorded during publication by default. With interactive mode enabled, Catapult lets you choose the target release.

## Usage

```bash
npx cata rollback [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--interactive`, `-i` | Prompt for the target release instead of using the previous one |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |


## Automatic rollback

If a task fails after `deploy:publish` and before `deploy:unlock`, Catapult attempts to restore the release that was active immediately before publication. A failed first deployment has no earlier release to restore. An SSH error while reading `current` aborts deployment before publication.

PM2 is reloaded from the restored release, and saved if `pm2:save` is in the pipeline. Services are restarted if `systemd:restart` is present. The application healthcheck is then rerun when configured. Rollback failures are reported; the deployment still fails even when recovery succeeds.

## Target and locking rules

The CLI and `Catapult.rollback()` API acquire the deployment lock before restoring a release. An existing lock prevents the operation. The target must exist and must not already be current.

Rollback removes the consumed `previous` reference. To select another release afterward, use `--interactive` (or the API's `release` option) until a new publication records `previous`. Existing installations without this reference also require interactive selection.

Cleanup protects `current` and `previous`. Interactive selection lists other retained directories too; an interrupted deployment can leave an incomplete directory, so choose a known working release.

Rollback restores code and restarts configured processes. It does not reverse database migrations or changes to shared files.


## Examples

```bash
npx cata rollback
npx cata rollback --interactive
npx cata rollback -i -H production
```

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/rollback.webm" type="video/webm"></video>

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/rollback-i.webm" type="video/webm"></video>