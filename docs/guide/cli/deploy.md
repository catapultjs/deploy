---
description: Deploy the current application to one or more configured servers.
---

# `deploy`

Runs the deployment pipeline for the selected hosts.

Alias: `dep`

If a target host has not been initialized yet, Catapult prompts to run `deploy:setup` before continuing.

## Usage

```bash
npx cata deploy [options]
npx cata dep [options]
```

## Options

| Option | Description |
| --- | --- |
| `--host <name>`, `-H <name>` | Target a specific host |
| `--branch <name>`, `-b <name>` | Override the branch for this deployment |
| `-v`, `-vv`, `-vvv` | Increase verbosity from normal to debug |
| `--config <path>`, `-c <path>` | Load a specific deploy config file |

## Examples

```bash
npx cata deploy
npx cata deploy --host production
npx cata deploy --branch feature/my-feature
npx cata deploy -vv
npx cata dep -H staging -b develop
npx cata deploy --config deploy.production.ts
npx cata deploy -c deploy.staging.ts
```

If a host uses a branch object with `ask: true`, Catapult prompts for the branch unless you pass `--branch`.

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/deploy.webm" type="video/webm"></video>