---
description: Deploy a Compose stack with Docker or Podman, build locally, transfer the image over SSH without registry, and roll back to the exact images of a release.
---

# `recipes/compose`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/compose.ts)

```typescript
import '@catapultjs/deploy/recipes/compose'
```

This recipe deploys a Compose stack with Docker or Podman. The application image is built on your machine, streamed to each server over SSH (no registry needed), and pinned per release. A rollback restarts the exact images and Compose files of the restored release.

The recipe owns its whole pipeline: it does not use `deploy:update_code`, so do not combine it with `git`, `rsync`, or an application recipe.

## Quick start

```typescript
// deploy.ts
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/compose'

set('container_engine', 'podman')
set('shared_files', ['.env'])
set('compose_migrate', { service: 'web', command: ['node', 'ace', 'migration:run', '--force'] })

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/srv/myapp',
      healthcheck: { url: 'http://127.0.0.1:3333/health', retries: 10 },
    },
  ],
})
```

```yaml
# compose.yml
services:
  web:
    build: .
    command: ['node', 'bin/server.js']
    env_file: .env
    ports: ['127.0.0.1:3333:3333']
    restart: always
  worker:
    image: myapp
    command: ['node', 'ace', 'queue:work']
    env_file: .env
    restart: always
  db:
    image: postgres:16
    volumes: ['pgdata:/var/lib/postgresql/data']
    restart: always
volumes:
  pgdata:
```

Run `npx cata deploy:setup` once, put the production `.env` in `shared/.env` on the server, then run `npx cata deploy`.

Add a `.containerignore` (or `.dockerignore`) that excludes at least `.env` and `node_modules`: the build context is your local directory, uncommitted changes included.

## How it works

1. The image is built locally once per deployment as `localhost/<container_image>:<release>`, for the architecture of the servers.
2. It is streamed to each server with `save | gzip | ssh | load`, without writing an archive. When the image did not change since the current release, the server only adds the new tag.
3. Compose files are uploaded into the release directory, and `shared_dirs` / `shared_files` are linked into it.
4. A generated override, `compose.catapult.yml`, pins the release image (`pull_policy: never`) for the services that use it: services with a `build` section, and services whose image is `container_image` (any tag). Your Compose files are never modified.
5. External images are pulled, the optional migration runs in a one-off container, `current` switches to the release, then `up -d --no-build` starts the stack.
6. Catapult waits until every container runs, and is healthy when it declares a healthcheck. A container that crashes right after start fails the deployment and triggers the automatic rollback.

Each release contains its Compose files, the override and a `release.json` manifest listing the image IDs. No secret is written to the manifest.

**Pipeline**

`deploy:lock` → `oci:check` → `compose:check` → `deploy:release` → `compose:upload` → `deploy:shared` → `compose:override` → `compose:validate` → `oci:build` → `oci:transfer` → `compose:pull` → `compose:migrate` → `deploy:publish` → `compose:up` → `deploy:log_revision` → `deploy:healthcheck` → `deploy:cleanup` → `oci:cleanup` → `deploy:unlock`

The configuration is validated on the server before the image is built, so a Compose error fails fast.

**Tasks**

| Task               | Inserted | Description                                                          |
| ------------------ | -------- | -------------------------------------------------------------------- |
| `oci:check`        | yes      | Detects the engine, checks access, architecture, disk and linger     |
| `compose:check`    | yes      | Checks the Compose provider (and Podman services)                    |
| `compose:upload`   | yes      | Uploads the Compose files and `compose_upload` paths                 |
| `compose:override` | yes      | Generates `compose.catapult.yml`                                     |
| `compose:validate` | yes      | Validates the configuration with the override                        |
| `oci:build`        | yes      | Builds the image locally, once for all hosts                         |
| `oci:transfer`     | yes      | Streams the image to the server and writes `release.json`            |
| `compose:pull`     | yes      | Pulls external images                                                |
| `compose:migrate`  | yes      | Runs `compose_migrate` when set                                      |
| `compose:up`       | yes      | Starts the stack and waits until containers are ready                |
| `oci:cleanup`      | yes      | Removes images of deleted releases, keeps a few local builds         |
| `compose:stop`     | manual   | Stops the containers                                                 |
| `compose:restart`  | manual   | Restarts the containers and waits until they are ready               |
| `compose:down`     | manual   | Removes containers and networks; volumes are kept                    |
| `compose:logs`     | manual   | Shows recent logs                                                    |
| `compose:status`   | manual   | Shows `compose ps`                                                   |

Manual tasks run against the current release: `npx cata task compose:logs`. For an interactive shell, use `npx cata ssh`, then `cd current` and run `docker compose exec` or `podman compose exec`.

`cata status` reports the engine version and the state of each container.

## Configuration

**Image**

| Key                      | Type                     | Default                  | Description                                                          |
| ------------------------ | ------------------------ | ------------------------ | -------------------------------------------------------------------- |
| `container_engine`       | `'docker' \| 'podman'`   | detected                 | Engine on the servers. Podman is preferred when both are installed   |
| `container_build_engine` | `'docker' \| 'podman'`   | server engine if present | Engine used for the local build                                      |
| `container_project`      | `string`                 | `package.json` name      | Compose project name, stable across releases (networks, volumes)     |
| `container_image`        | `string`                 | `container_project`      | Repository name of the release image, without registry or tag        |
| `container_build`        | `object`                 | `{}`                     | `file`, `context`, `target`, `args`, `platform`                      |
| `container_source`       | `string`                 | none                     | Existing image to deploy instead of building (pulled on the server)  |
| `container_compression`  | `'gzip' \| 'zstd' \| 'none'` | `'gzip'`             | Transfer compression. `zstd` requires `zstd` on the server           |
| `container_keep_local`   | `number`                 | `2`                      | Release images kept on the build machine                             |

`container_build.file` defaults to `Containerfile`, then `Dockerfile`, in `context` (default `.`). `container_build.platform` defaults to the architecture of the servers; a deployment targets one architecture.

Build arguments end up in the image metadata: never pass secrets with `container_build.args`.

**Compose**

| Key                      | Type                                   | Default        | Description                                                         |
| ------------------------ | -------------------------------------- | -------------- | ------------------------------------------------------------------- |
| `compose_files`          | `string[]`                             | detected       | Compose files, relative to the project. Defaults to the first of `compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml` |
| `compose_upload`         | `string[]`                             | `[]`           | Extra files or directories referenced by the stack (configs, scripts) |
| `compose_profiles`       | `string[]`                             | `[]`           | Profiles to enable                                                  |
| `compose_services`       | `string[]`                             | all            | Services started and checked                                        |
| `compose_image_services` | `string[]`                             | detected       | Services pinned to the release image                                |
| `compose_migrate`        | `{ service: string, command: string[] }` | none         | Command run with `compose run --rm` before publication              |
| `compose_remove_orphans` | `boolean`                              | `false`        | Adds `--remove-orphans` to `up`, also on rollback                   |
| `compose_wait_timeout`   | `number`                               | `60`           | Seconds to wait for containers to be ready                          |
| `compose_logs_lines`     | `number`                               | `100`          | Lines shown by `compose:logs`                                       |

All keys are available in [JSON configurations](/guide/json-configuration) with `"recipes": ["compose"]`.

## Server requirements

Catapult checks the server but never installs or changes anything on it.

- **Docker**: the Compose plugin (`docker compose version`), and a deploy user allowed to use Docker.
- **Podman**: a Compose provider for `podman compose` (`docker-compose` or `podman-compose`). With `docker-compose`, the Podman API socket must be active: `systemctl --user enable --now podman.socket`.
- **Podman after a reboot**: restart policies are applied by `podman-restart.service`. Enable it with `systemctl --user enable podman-restart.service` (without `--user` for rootful Podman).
- **Rootless Podman**: enable lingering so containers survive the end of the SSH session: `sudo loginctl enable-linger <user>`.

## Data and volumes

Keep persistent data in named volumes or in `shared_dirs`. Relative bind mounts resolve inside the release directory, which changes on every deployment. The project name stays the same across releases, so named volumes and networks are reused. No volume is ever removed: `compose:down` keeps them.

## Rollback

`npx cata rollback` switches `current` back and runs `up` with the Compose files and override of the restored release. It is refused before any change when the target has no manifest, no override, or when its image is no longer on the server.

A rollback does not restore data or reverse migrations. Write migrations that the previous release can still run against, or restore a backup.

## Limitations

- The whole image is transferred when it changed: layers already on the server are not reused.
- `container_source` pulls the image only when it is missing on the server. Use immutable tags or digests.
- Registries, remote builds and several architectures per deployment are not supported yet.
