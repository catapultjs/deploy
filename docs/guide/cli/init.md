---
description: Create a starter deploy config file and optionally install Catapult.
---

# `init`

Creates a starter `deploy.config.ts`, `deploy.config.js` or `deploy.config.json` file, then installs `@catapultjs/deploy` as a dev dependency with the detected package manager unless you pass `--skip-install`.

## Usage

```bash
npx @catapultjs/deploy init
```

## Options

| Option | Description |
| --- | --- |
| `--skip-install` | Create the config file without installing `@catapultjs/deploy` |

## What it does

1. Prompts you to choose TypeScript, JavaScript or JSON.
2. Creates `deploy.config.ts`, `deploy.config.js` or `deploy.config.json` in the current directory.
3. Installs `@catapultjs/deploy` with the detected package manager, unless you use `--skip-install`.

The JSON template includes `version: 1` and the public schema reference `https://catapultjs.com/schema/deploy.schema.json`. See [JSON configuration](/guide/json-configuration) for the complete format.

## Examples

```bash
npx @catapultjs/deploy init
npx @catapultjs/deploy init --skip-install
```

This command does not require a deploy config file.

## Output example

<video controls autoplay loop muted playsinline preload="metadata" style="width: 100%; border-radius: 12px;"><source src="/videos/init.webm" type="video/webm"></video>
