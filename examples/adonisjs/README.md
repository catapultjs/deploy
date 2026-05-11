# AdonisJS example

This example shows three ways to deploy an AdonisJS application with Catapult.

## Deploy files

### `deploy.ts`

This file uses the `adonisjs`, `git`, and `pm2` recipes together.

- `git` deploys the repository source code to the server
- `adonisjs` installs dependencies and builds the application on the server
- `pm2` can be used for process management after publish

Use this version when the server should receive the project source and handle the build itself.

### `deploy.rsync.ts`

This file keeps the AdonisJS build on the server, but replaces the transfer step with `rsync` instead of `git`.

It excludes local files and directories that should not be uploaded, such as `node_modules`, `.env`, `tmp`, `logs`, `storage`, and local deploy config files.

Use this version when you want a file sync workflow instead of a Git-based deployment, while still building on the server.

### `deploy.locale.ts`

This file switches to a local build workflow.

It defines custom `deploy:build`, `deploy:update_code`, and `deploy:install` tasks to:

- run `node ace build` locally
- upload the generated `build/` directory to the release
- install production dependencies in the uploaded release on the server

Use this version when you want to build AdonisJS locally and deploy built artifacts instead of the repository source.
