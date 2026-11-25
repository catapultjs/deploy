---
description: Run containers from a locally built image with Docker or Podman, without Compose or registry, and roll back to the exact containers of a release.
---

# `recipes/container`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/container.ts)

```typescript
import '@catapultjs/deploy/recipes/container'
```

This recipe runs one or more containers from your application image with Docker or Podman, without Compose. The image is built on your machine, streamed to each server over SSH (no registry needed), and each release records how its containers were started, so a rollback restarts the exact previous containers.

Use it for an application made of a few processes sharing one image: a web server, workers, a scheduler. For databases or several images, prefer [`compose`](./compose). The recipe owns its whole pipeline: do not combine it with `git`, `rsync`, or an application recipe.

## Quick start

```typescript
// deploy.ts
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/container'

set('container_engine', 'podman')
set('shared_files', ['.env'])
set('shared_dirs', ['storage'])
set('container_services', {
  web: {
    command: ['node', 'bin/server.js'],
    init: true,
    env: { PORT: '3333' },
    env_file: ['.env'],
    ports: ['127.0.0.1:3333:3333'],
    volumes: ['./storage:/app/storage'],
  },
  worker: {
    command: ['node', 'ace', 'queue:work'],
    init: true,
    healthcheck: false,
    env_file: ['.env'],
  },
})
set('container_migrate', { service: 'web', command: ['node', 'ace', 'migration:run', '--force'] })

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

Run `npx cata deploy:setup` once, put the production `.env` in `shared/.env` on the server, then run `npx cata deploy`.

Add a `.containerignore` (or `.dockerignore`) that excludes at least `.env` and `node_modules`: the build context is your local directory, uncommitted changes included.

## How it works

1. The image is built locally once per deployment as `localhost/<container_image>:<release>`, and streamed to each server over SSH. When it did not change since the current release, the server only adds the new tag.
2. `shared_dirs` / `shared_files` are linked into the release. The `env` values of each service are written to `container/<service>.env` in the release, readable by the deploy user only.
3. The optional migration runs in a one-off container of the new image, on the project network, with the service's env files, user and volumes. A failure stops the deployment before publication.
4. After publication, each service container (`<container_project>-<service>`) is stopped, removed and started again from the new image. Containers of services removed from `container_services` are stopped and removed.
5. Catapult waits until every container runs, and is healthy when the image declares a healthcheck, then checks again 3 seconds later. A container that exits, becomes unhealthy, restarts in between, or restarts repeatedly while waiting (a crash loop hidden by the restart policy) fails the deployment and triggers the automatic rollback.

All services share a network named after `container_project`, so they reach each other by container name. Ports are released between stop and start: expect a short interruption on each deployment.

The release manifest records how each service is started: command, ports, volumes, labels and env file paths, but never the values of environment variables.

**Pipeline**

`deploy:lock` → `oci:check` → `container:check` → `deploy:release` → `deploy:shared` → `container:prepare` → `oci:build` → `oci:transfer` → `container:migrate` → `deploy:publish` → `container:up` → `deploy:log_revision` → `deploy:healthcheck` → `deploy:cleanup` → `oci:cleanup` → `deploy:unlock`

**Tasks**

| Task                | Inserted | Description                                                      |
| ------------------- | -------- | ---------------------------------------------------------------- |
| `oci:check`         | yes      | Detects the engine, checks access, architecture, disk and linger |
| `container:check`   | yes      | Validates `container_services`, checks `podman-restart.service`  |
| `container:prepare` | yes      | Writes env files and records the services of the release         |
| `oci:build`         | yes      | Builds the image locally, once for all hosts                     |
| `oci:transfer`      | yes      | Streams the image to the server and writes `release.json`        |
| `container:migrate` | yes      | Runs `container_migrate` when set                                |
| `container:up`      | yes      | Replaces the containers and waits until they are ready           |
| `oci:cleanup`       | yes      | Removes images of deleted releases, keeps a few local builds     |
| `container:start`   | manual   | Starts the existing containers                                   |
| `container:stop`    | manual   | Stops the containers                                             |
| `container:restart` | manual   | Restarts the containers and waits until they are ready           |
| `container:remove`  | manual   | Stops and removes the containers; volumes and network are kept   |
| `container:logs`    | manual   | Shows recent logs of each container                              |
| `container:status`  | manual   | Lists the containers of the project                              |

Manual tasks run against the current release: `npx cata task container:logs`. For an interactive shell, use `npx cata ssh`, then `podman exec -it <project>-web sh`.

`cata status` reports the engine version and the state of each container.

## Configuration

**Services**

`container_services` maps service names to their options. Every option is optional.

| Option        | Type                     | Default    | Description                                                        |
| ------------- | ------------------------ | ---------- | ------------------------------------------------------------------ |
| `command`     | `string[]`               | image CMD  | Command and arguments, passed without shell                        |
| `init`        | `boolean`                | `false`    | Runs an init process as PID 1 (signal forwarding, zombie reaping)  |
| `healthcheck` | `boolean \| object`      | image      | `false` disables the image `HEALTHCHECK`, an object replaces it    |
| `entrypoint`  | `string`                 | image      | Executable replacing the image entrypoint                          |
| `user`        | `string`                 | image      | `user` or `uid:gid`                                                |
| `env`         | `Record<string, string>` | `{}`       | Non-secret variables, written to an env file of the release        |
| `env_file`    | `string[]`               | `[]`       | Env files, relative to the release (e.g. a shared `.env`)          |
| `ports`       | `string[]`               | `[]`       | Published ports, e.g. `127.0.0.1:3333:3333`                        |
| `volumes`     | `string[]`               | `[]`       | `./dir:/path`, `/abs:/path` or `named:/path`, with `:ro` if needed |
| `restart`     | `string`                 | `'always'` | `no`, `always`, `unless-stopped` or `on-failure[:N]`               |
| `labels`      | `Record<string, string>` | `{}`       | Extra labels (the `com.catapultjs.` prefix is reserved)            |
| `memory`      | `string`                 | none       | Memory limit, e.g. `512m` or `2g`                                  |
| `cpus`        | `number \| string`       | none       | CPU limit, e.g. `1.5`                                              |
| `networks`    | `string[]`               | `[]`       | Existing networks joined in addition to the project network        |
| `options`     | `string[]`               | `[]`       | Raw engine options, e.g. `--cap-drop=ALL`                          |

Keep secrets in `env_file` (typically a shared `.env`), never in `env`: values are passed as env files, never on the command line. Relative volume sources resolve inside the release directory: point them to `shared_dirs` entries to keep data across releases, or use named volumes.

Enable `init` for processes that do not handle `SIGTERM`, such as Node.js running as PID 1: without it, each stop waits `container_stop_timeout` seconds before the container is killed.

Set `healthcheck: false` on services the image `HEALTHCHECK` does not apply to, such as a worker sharing the image of an HTTP server: otherwise the worker never becomes healthy and the deployment fails.

An object defines the healthcheck in the configuration instead of the image. It also works where Podman drops the image `HEALTHCHECK` (see [Limitations](#limitations)). `cmd` runs with `/bin/sh -c` inside the container; durations use the `30s` or `1m30s` format:

```typescript
web: {
  command: ['node', 'bin/server.js'],
  healthcheck: {
    cmd: 'wget -qO- http://127.0.0.1:3333/health || exit 1',
    interval: '10s',
    timeout: '3s',
    retries: 3,
    start_period: '5s',
  },
  memory: '512m',
  cpus: 1.5,
  networks: ['proxy'],
}
```

`networks` lists networks created outside Catapult, such as the network of a reverse proxy: Catapult checks that they exist and never creates them. Joining several networks requires Docker 25 or later. `options` passes extra flags to `run` for what the recipe does not cover; the options it manages (`--name`, `--network`, `--restart`, `--rm`, `--detach`) are refused.

Extra networks, resource limits and `options` also apply to the one-off migration container, so it reaches the same services.

Labels apply to service containers only, not to the one-off migration container, so reverse-proxy routing labels never target it.

**Other keys**

| Key                      | Type                                     | Default | Description                                     |
| ------------------------ | ---------------------------------------- | ------- | ----------------------------------------------- |
| `container_migrate`      | `{ service: string, command: string[] }` | none    | One-off command run before publication          |
| `container_wait_timeout` | `number`                                 | `60`    | Seconds to wait for containers to be ready      |
| `container_stop_timeout` | `number`                                 | `10`    | Seconds given to a container to stop gracefully |
| `container_logs_lines`   | `number`                                 | `100`   | Lines shown per container by `container:logs`   |

The image options (`container_engine`, `container_build_engine`, `container_project`, `container_image`, `container_build`, `container_source`, `container_compression`, `container_keep_local`) are the same as for [`compose`](./compose#configuration), as is the [transfer through a registry](./compose#transfer-through-a-registry) (`container_transfer`, `container_registry`).

All keys are available in [JSON configurations](/guide/json-configuration) with `"recipes": ["container"]`.

## Server requirements

Catapult checks the server but never installs or changes anything on it.

- **Docker**: a deploy user allowed to use Docker. Restart policies are applied by the Docker daemon after a reboot.
- **Podman**: restart policies are applied after a reboot by `podman-restart.service`. Enable it with `systemctl --user enable podman-restart.service` (without `--user` for rootful Podman).
- **Rootless Podman**: enable lingering so containers survive the end of the SSH session: `sudo loginctl enable-linger <user>`.

## Rollback

`npx cata rollback` switches `current` back and recreates the containers recorded by the restored release, with its image and env files. It is refused before any change when the target has no recorded configuration, misses an env file, or when its image is no longer on the server.

A rollback does not restore data or reverse migrations. Write migrations that the previous release can still run against, or restore a backup.

## Limitations

- Containers are replaced in place: a short interruption happens on fixed ports.
- One image per project. Use `compose` for stacks combining several images.
- Podman ignores the image `HEALTHCHECK` for OCI images, the format produced by Docker with the containerd image store: Catapult warns when it is lost. Declare `healthcheck` in the service, or build with Podman locally.
