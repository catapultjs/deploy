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
    init: true
    command: ['node', 'bin/server.js']
    env_file: .env
    ports: ['127.0.0.1:3333:3333']
    restart: always
  worker:
    image: myapp
    init: true
    command: ['node', 'ace', 'queue:work']
    healthcheck:
      disable: true
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

Set `init: true` on Node.js services: without an init process, Node.js as PID 1 ignores `SIGTERM` and every container replacement waits 10 seconds before the container is killed.

A service sharing the image of another one inherits its `HEALTHCHECK`: disable it with `healthcheck: { disable: true }` when it does not apply, like an HTTP check on a worker. Otherwise the service never becomes healthy and the deployment fails.

## How it works

1. The image is built locally once per deployment as `localhost/<container_image>:<release>`, for the architecture of the servers.
2. It is streamed to each server with `save | gzip | ssh | load`, without writing an archive. When the image did not change since the current release, the server only adds the new tag.
3. Compose files are uploaded into the release directory, and `shared_dirs` / `shared_files` are linked into it.
4. A generated override, `compose.catapult.yml`, pins the release image (`pull_policy: never`) for the services that use it: services with a `build` section, and services whose image is `container_image` (any tag). Your Compose files are never modified.
5. External images are pulled, the optional migration runs in a one-off container, `current` switches to the release, then `up -d --no-build` starts the stack.
6. Catapult waits until every container runs, and is healthy when it declares a healthcheck, then checks again 3 seconds later. A container that exits, becomes unhealthy, restarts in between, or restarts repeatedly while waiting (a crash loop hidden by `restart: always`) fails the deployment and triggers the automatic rollback. Crashes happening later are left to `deploy:healthcheck`.

Each release contains its Compose files, the override and a `release.json` manifest listing the image IDs. No secret is written to the manifest.

Images are cleaned per project: the server keeps a list of the images each project created (`.catapult/images`), so two projects sharing an image name never remove each other's images.

**Pipeline**

`deploy:lock` → `oci:check` → `compose:check` → `deploy:release` → `compose:upload` → `deploy:shared` → `compose:override` → `compose:validate` → `oci:build` → `oci:transfer` → `compose:pull` → `compose:migrate` → `deploy:publish` → `compose:up` → `deploy:log_revision` → `deploy:healthcheck` → `deploy:cleanup` → `oci:cleanup` → `deploy:unlock`

The configuration is validated on the server before the image is built, so a Compose error fails fast.

**Tasks**

| Task               | Inserted | Description                                                      |
| ------------------ | -------- | ---------------------------------------------------------------- |
| `oci:check`        | yes      | Detects the engine, checks access, architecture, disk and linger |
| `compose:check`    | yes      | Checks the Compose provider (and Podman services)                |
| `compose:upload`   | yes      | Uploads the Compose files and `compose_upload` paths             |
| `compose:override` | yes      | Generates `compose.catapult.yml`                                 |
| `compose:validate` | yes      | Validates the configuration with the override                    |
| `oci:build`        | yes      | Builds the image locally, once for all hosts                     |
| `oci:transfer`     | yes      | Streams the image to the server and writes `release.json`        |
| `compose:pull`     | yes      | Pulls external images                                            |
| `compose:migrate`  | yes      | Runs `compose_migrate` when set                                  |
| `compose:up`       | yes      | Starts the stack and waits until containers are ready            |
| `oci:cleanup`      | yes      | Removes images of deleted releases, keeps a few local builds     |
| `compose:stop`     | manual   | Stops the containers                                             |
| `compose:restart`  | manual   | Restarts the containers and waits until they are ready           |
| `compose:down`     | manual   | Removes containers and networks; volumes are kept                |
| `compose:logs`     | manual   | Shows recent logs                                                |
| `compose:status`   | manual   | Shows `compose ps`                                               |

Manual tasks run against the current release: `npx cata task compose:logs`. For an interactive shell, use `npx cata ssh`, then `cd current` and run `docker compose exec` or `podman compose exec`.

`cata status` reports the engine version and the state of each container.

## Configuration

**Image**

| Key                      | Type                         | Default                  | Description                                                                     |
| ------------------------ | ---------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `container_engine`       | `'docker' \| 'podman'`       | detected                 | Engine on the servers. Podman is preferred when both are installed              |
| `container_build_engine` | `'docker' \| 'podman'`       | server engine if present | Engine used for the local build                                                 |
| `container_project`      | `string`                     | `package.json` name      | Compose project name, stable across releases (networks, volumes)                |
| `container_image`        | `string`                     | `container_project`      | Repository name of the release image, without registry or tag                   |
| `container_build`        | `object`                     | `{}`                     | `location`, `file`, `context`, `target`, `args`, `platform`                     |
| `container_source`       | `string`                     | none                     | Existing image to deploy instead of building (pulled on the server)             |
| `container_compression`  | `'gzip' \| 'zstd' \| 'none'` | `'gzip'`                 | Transfer compression. `zstd` requires `zstd` on the server                      |
| `container_transfer`     | `'ssh' \| 'registry'`        | `'ssh'`                  | How the image reaches the servers, see [registry](#transfer-through-a-registry) |
| `container_registry`     | `{ repository, auth? }`      | none                     | Registry settings when `container_transfer` is `'registry'`                     |
| `container_keep_local`   | `number`                     | `2`                      | Release images kept on the build machine                                        |

`container_build.file` defaults to `Containerfile`, then `Dockerfile`, in `context` (default `.`). `container_build.platform` defaults to the architecture of the servers; a deployment targets one architecture.

Build arguments end up in the image metadata: never pass secrets with `container_build.args`.

With Podman, a build argument only invalidates the layer cache of `RUN` instructions: an `ENV` or `LABEL` using an argument before any `RUN` keeps its previous value when only the argument changes. Catapult warns about it; add a `RUN` instruction between the `ARG` and the instructions using it. Docker is not affected.

**Compose**

| Key                      | Type                                     | Default  | Description                                                                                                                                 |
| ------------------------ | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose_files`          | `string[]`                               | detected | Compose files, relative to the project. Defaults to the first of `compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml` |
| `compose_upload`         | `string[]`                               | `[]`     | Extra files or directories referenced by the stack (configs, scripts)                                                                       |
| `compose_profiles`       | `string[]`                               | `[]`     | Profiles to enable                                                                                                                          |
| `compose_services`       | `string[]`                               | all      | Services started and checked                                                                                                                |
| `compose_image_services` | `string[]`                               | detected | Services pinned to the release image                                                                                                        |
| `compose_migrate`        | `{ service: string, command: string[] }` | none     | Command run with `compose run --rm` before publication                                                                                      |
| `compose_remove_orphans` | `boolean`                                | `false`  | Adds `--remove-orphans` to `up`, also on rollback                                                                                           |
| `compose_wait_timeout`   | `number`                                 | `60`     | Seconds to wait for containers to be ready                                                                                                  |
| `compose_logs_lines`     | `number`                                 | `100`    | Lines shown by `compose:logs`                                                                                                               |

All keys are available in [JSON configurations](/guide/json-configuration) with `"recipes": ["compose"]`.

## Build on the servers

By default the image is built on your machine. Set `container_build.location` to `'remote'` to build it on each server instead, natively for its architecture and with its own layer cache:

```typescript
set('container_build', { location: 'remote', args: { APP_VERSION: '1.4.0' } })
```

1. The build context is synchronized with rsync to `.catapult/build/` on each server. The directory is kept between deployments, so only changes are sent.
2. Each server builds the release image under its release reference: nothing is transferred afterwards, and Compose files, containers and Quadlet units are unchanged.

Paths ignored by the ignore file the server engine reads (`.dockerignore` for Docker, `.containerignore` then `.dockerignore` for Podman) are not sent, `.git` neither. When the ignore file re-includes paths (`!pattern`), the whole context is sent and the engine applies the file. The Containerfile must be inside the context.

Every server builds its own image: prefer a local build or a registry for many servers. rsync is required on your machine and on the servers. This mode cannot be combined with `container_build.platform` or `container_transfer: 'registry'`. Catapult never prunes the build cache of the servers: clean it with `docker builder prune` or `podman image prune` when needed.

## Transfer through a registry

By default the image is streamed to each server over SSH. With several servers, or when you already push images from CI, push it once to a registry instead: each server pulls it by digest.

```typescript
set('container_transfer', 'registry')
set('container_registry', {
  repository: 'ghcr.io/acme/myapp',
  auth: { username_env: 'REGISTRY_USER', password_env: 'REGISTRY_TOKEN' },
})
```

1. The image built locally is pushed once as `<repository>:<release>`, whatever the number of servers. Log in to the registry on the build machine first, e.g. `docker login ghcr.io`.
2. Each server pulls it by digest (`<repository>@sha256:...`) and tags it as the release image, so Compose files, containers and Quadlet units are unchanged. When the image did not change since the current release, the server only adds the new tag.
3. The digest is recorded in `release.json`: a rollback pulls the image again when it is no longer on the server.

`auth` names the local environment variables holding the credentials of the servers. The password goes through the SSH connection input, never on a command line, and the servers log in with a temporary auth file removed after the pull: no credentials stay on them. Without `auth`, the servers must already be logged in, or the registry be public. For GitHub Container Registry, give the servers a token limited to `read:packages`.

Images are never removed from the registry: rely on its retention policy. Servers and the build machine are cleaned up as with the SSH transfer.

The same options apply to [`container`](./container) and [`quadlet`](./quadlet).

## Server requirements

Catapult checks the server but never installs or changes anything on it.

- **Docker**: the Compose plugin (`docker compose version`), and a deploy user allowed to use Docker.
- **Podman**: a Compose provider for `podman compose` (`docker-compose` or `podman-compose`). With `docker-compose`, the Podman API socket must be active, otherwise `compose:check` fails: `systemctl --user enable --now podman.socket`.
- **Podman after a reboot**: restart policies are applied by `podman-restart.service`. Enable it with `systemctl --user enable podman-restart.service` (without `--user` for rootful Podman).
- **Rootless Podman**: enable lingering so containers survive the end of the SSH session: `sudo loginctl enable-linger <user>`.

Providers name containers differently (`app-web-1` with `docker-compose`, `app_web_1` with `podman-compose`). Before switching provider on a server, run `npx cata task compose:down`, otherwise the old containers keep their ports.

**Image healthchecks with Podman**: Podman ignores the `HEALTHCHECK` of OCI images, the format produced by Docker with the containerd image store (the default on recent installations). Catapult warns when the healthcheck of your image is lost on the server: declare it in `compose.yml` (`healthcheck:`) instead. Images built locally with Podman keep it (Catapult builds them in Docker format).

## Data and volumes

Keep persistent data in named volumes or in `shared_dirs`. Relative bind mounts resolve inside the release directory, which changes on every deployment. The project name stays the same across releases, so named volumes and networks are reused. No volume is ever removed: `compose:down` keeps them.

## Rollback

`npx cata rollback` switches `current` back and runs `up` with the Compose files and override of the restored release. It is refused before any change when the target has no manifest, no override, or when its image is no longer on the server.

A rollback does not restore data or reverse migrations. Write migrations that the previous release can still run against, or restore a backup.

## Limitations

- The whole image is transferred when it changed: layers already on the server are not reused.
- `container_source` pulls the image only when it is missing on the server. Use immutable tags or digests.
- Registries, remote builds and several architectures per deployment are not supported yet.
