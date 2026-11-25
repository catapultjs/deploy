---
description: Run your application as systemd services with Podman Quadlet, from a locally built image streamed over SSH, and roll back to the exact units of a release.
---

# `recipes/quadlet`

[View source on GitHub](https://github.com/catapultjs/deploy/blob/main/recipes/quadlet.ts)

```typescript
import '@catapultjs/deploy/recipes/quadlet'
```

This recipe deploys your application as systemd services with [Podman Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html). You write the Quadlet files of the project (`.container`, `.network`, `.volume`, `.pod`). Catapult builds the image on your machine, streams it to each server over SSH (no registry needed), renders the files for each release and installs them. systemd then starts and supervises the containers, at boot too.

Use it on Podman servers where containers should be managed like any other service, with `systemctl`, `journalctl`, restart policies and unit dependencies. For Docker servers or a stack described in one file, prefer [`compose`](./compose). The recipe owns its whole pipeline: do not combine it with `git`, `rsync`, or an application recipe.

## Quick start

```typescript
// deploy.ts
import { defineConfig, set } from '@catapultjs/deploy'
import '@catapultjs/deploy/recipes/quadlet'

set('container_project', 'myapp')
set('shared_files', ['.env'])
set('shared_dirs', ['storage'])

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

```ini
# quadlet/myapp-web.container
[Unit]
Description=myapp web

[Container]
Image={{image}}
Exec=node bin/server.js
EnvironmentFile={{release_path}}/.env
Environment=PORT=3333
PublishPort=127.0.0.1:3333:3333
Volume={{shared_path}}/storage:/app/storage
Network=myapp.network
PodmanArgs=--init

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```ini
# quadlet/myapp-worker.container
[Container]
Image={{image}}
Exec=node ace queue:work
EnvironmentFile={{release_path}}/.env
Network=myapp.network
HealthCmd=none
PodmanArgs=--init

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```ini
# quadlet/myapp.network
[Network]
```

Run `npx cata deploy:setup` once, put the production `.env` in `shared/.env` on the server, then run `npx cata deploy`.

Unit names are shared by every project of the deploy user: prefix the file names with the project (`myapp-web.container` becomes `myapp-web.service`). Catapult refuses to install a file whose name is already used by another project.

`PodmanArgs=--init` runs an init process as PID 1: Node.js as PID 1 ignores `SIGTERM`, so each restart would wait for the stop timeout. `HealthCmd=none` disables the image `HEALTHCHECK` on a service it does not apply to, like an HTTP check on a worker.

Add a `.containerignore` (or `.dockerignore`) that excludes at least `.env` and `node_modules`: the build context is your local directory, uncommitted changes included.

## Placeholders

::: v-pre
The files are rendered for each release with these values:

| Placeholder        | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `{{image}}`        | Release image, `localhost/<container_image>:<release>`               |
| `{{release}}`      | Release name                                                         |
| `{{release_path}}` | Release directory, where `shared_files` and `shared_dirs` are linked |
| `{{shared_path}}`  | Shared directory                                                     |
| `{{base_path}}`    | `deployPath` of the host                                             |
| `{{project}}`      | `container_project`                                                  |

An unknown placeholder fails the deployment. Podman format strings such as `{{.Name}}` are left untouched.

Reference the project image with `Image={{image}}`: a tag of the project repository other than the release (`Image=localhost/myapp:latest`) is rejected. Use `{{release_path}}` or `{{shared_path}}` for host paths: Quadlet resolves relative paths from the directory of the installed file.
:::

## How it works

1. Catapult checks the server: Podman with its Quadlet generator, a reachable systemd manager, cgroups v2 and linger in rootless mode, and no unit of the same name installed by another project.
2. The files of `quadlet_path` are rendered into `quadlet/` in the release, readable by the deploy user only, then validated with the Quadlet generator before anything is built. Each `.container` file gets two labels, `com.catapultjs.project` and `com.catapultjs.service`, so Catapult finds its containers.
3. The image is built locally once per deployment and streamed to each server. When it did not change since the current release, the server only adds the new tag.
4. After publication, the files are installed in the project directory, files removed from the project are uninstalled (their units stopped first), and systemd reloads. Only units whose file changed are restarted: a unit on an external image keeps running.
5. Catapult waits until every service unit is active, then until its containers run and are healthy, and checks the units again. A unit that fails or restarts repeatedly while starting (a crash loop driven by `Restart=`), or a container that becomes unhealthy, fails the deployment and triggers the automatic rollback.

Units start at boot through their `[Install]` section (`WantedBy=default.target`): Catapult warns about `.container` and `.pod` files without one, except oneshot units. It never runs `systemctl enable`, which does not apply to generated units.

The mode follows the SSH user, as images are loaded in the storage of the user who runs the units:

| Mode     | Connect as     | Files installed in                        | Commands                                |
| -------- | -------------- | ----------------------------------------- | --------------------------------------- |
| Rootless | a regular user | `~/.config/containers/systemd/<project>/` | `systemctl --user`, `journalctl --user` |
| Rootful  | `root`         | `/etc/containers/systemd/<project>/`      | `systemctl`, `journalctl`               |

**Pipeline**

`deploy:lock` → `oci:check` → `quadlet:check` → `deploy:release` → `deploy:shared` → `quadlet:render` → `quadlet:validate` → `oci:build` → `oci:transfer` → `deploy:publish` → `quadlet:up` → `deploy:log_revision` → `deploy:healthcheck` → `deploy:cleanup` → `oci:cleanup` → `deploy:unlock`

**Tasks**

| Task                | Inserted | Description                                                       |
| ------------------- | -------- | ----------------------------------------------------------------- |
| `oci:check`         | yes      | Detects Podman, checks access, architecture, disk and linger      |
| `quadlet:check`     | yes      | Checks the generator, systemd, cgroups v2 and unit name conflicts |
| `quadlet:render`    | yes      | Renders the Quadlet files into the release                        |
| `quadlet:validate`  | yes      | Validates the rendered files with the Quadlet generator           |
| `oci:build`         | yes      | Builds the image locally, once for all hosts                      |
| `oci:transfer`      | yes      | Streams the image to the server and writes `release.json`         |
| `quadlet:up`        | yes      | Installs the units, restarts the changed ones, waits until ready  |
| `oci:cleanup`       | yes      | Removes images of deleted releases, keeps a few local builds      |
| `quadlet:start`     | manual   | Starts the units and waits until they are ready                   |
| `quadlet:stop`      | manual   | Stops the units                                                   |
| `quadlet:restart`   | manual   | Restarts the units and waits until they are ready                 |
| `quadlet:uninstall` | manual   | Stops the units and removes their files; volumes are kept         |
| `quadlet:logs`      | manual   | Shows the journal of the units                                    |
| `quadlet:status`    | manual   | Shows `systemctl status` of the units                             |

Manual tasks run against the current release: `npx cata task quadlet:logs`. `cata status` reports the state of each unit.

## Configuration

| Key                    | Type     | Default     | Description                               |
| ---------------------- | -------- | ----------- | ----------------------------------------- |
| `quadlet_path`         | `string` | `'quadlet'` | Local directory holding the Quadlet files |
| `quadlet_wait_timeout` | `number` | `60`        | Seconds to wait for the units to be ready |
| `quadlet_logs_lines`   | `number` | `100`       | Journal lines shown by `quadlet:logs`     |

`quadlet_path` holds `.container`, `.network`, `.volume` and `.pod` files, without subdirectories. Hidden files are ignored.

The image options (`container_build_engine`, `container_project`, `container_image`, `container_build`, `container_source`, `container_compression`, `container_keep_local`) are the same as for [`compose`](./compose#configuration), as is the [transfer through a registry](./compose#transfer-through-a-registry) (`container_transfer`, `container_registry`). `container_engine` is set to `podman`.

All keys are available in [JSON configurations](/guide/json-configuration) with `"recipes": ["quadlet"]`.

## Migrations

There is no migration step before publication. Add a oneshot `.container` unit and make your services depend on it: it runs before them on each start, including at boot.

```ini
# quadlet/myapp-migrate.container
[Container]
Image={{image}}
Exec=node ace migration:run --force
EnvironmentFile={{release_path}}/.env
Network=myapp.network
HealthCmd=none

[Service]
Type=oneshot
RemainAfterExit=yes
```

```ini
# quadlet/myapp-web.container
[Unit]
Requires=myapp-migrate.service
After=myapp-migrate.service
```

The migration runs after publication: when it fails, the deployment fails and the previous release is restored, its migration unit included.

## Server requirements

Catapult checks the server but never installs or changes anything on it.

- **Podman** 4.4 or later, with systemd and cgroups v2 (required in rootless mode).
- **Rootless**: enable lingering, so the user manager runs without SSH session and starts the units at boot: `sudo loginctl enable-linger <user>`.
- **Rootful**: connect as `root`. Running Podman through `sudo` is not supported.

## Rollback

`npx cata rollback` switches `current` back, reinstalls the rendered files of the restored release, restarts the changed units and waits until they are ready. It is refused before any change when the target misses its rendered files, or when its image is no longer on the server. The failed state of the units is cleared first, so units stopped by systemd after a crash loop start again.

A rollback does not restore data or reverse migrations. Write migrations that the previous release can still run against, or restore a backup.

## Limitations

- `.build`, `.image` and `.kube` files are not supported, nor `ServiceName=`: Catapult derives unit names from file names.
- Units are restarted in place: a short interruption happens on fixed ports.
- One image per project.
- Healthchecks come from the image (`HEALTHCHECK`) or from `HealthCmd=`. Podman ignores the image `HEALTHCHECK` for OCI images, the format produced by Docker with the containerd image store: Catapult warns when it is lost. Declare `HealthCmd=` in the `.container` file, or build with Podman locally.
