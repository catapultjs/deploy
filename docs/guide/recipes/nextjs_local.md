---
description: Build a Next.js standalone server locally and upload it with Catapult.
---

# `recipes/nextjs_local`

```typescript
import '@catapultjs/deploy/recipes/nextjs_local'
```

Builds the application locally and uploads the standalone output, including traced runtime
dependencies. No dependency installation or build runs on the server. Do not combine with
`nextjs`, `nextjs_static`, `git`, or `rsync`: this recipe provides code delivery itself.

Enable standalone output in `next.config.js`:

```javascript
export default {
  output: 'standalone',
}
```

| Task                 | Inserted                 | Description                                                         |
| -------------------- | ------------------------ | ------------------------------------------------------------------- |
| `deploy:build`       | before `deploy:lock`     | Runs the package manager's `next build` locally and prepares assets |
| `deploy:update_code` | existing deployment step | Uploads the standalone directory contents via SCP                   |

The recipe copies `.next/static` and optional `public` into the directory containing the
standalone `server.js`. An optional `ecosystem.config.cjs` from the app directory is copied
to the uploaded output root. Files are copied, so deployed assets do not depend on paths
on the build machine. A missing standalone server fails the build before upload.

| Key                     | Type       | Default              | Description                                                               |
| ----------------------- | ---------- | -------------------- | ------------------------------------------------------------------------- |
| `nextjs_path`           | `string`   | `''`                 | Local app directory, relative to the working directory or absolute        |
| `nextjs_out_path`       | `string`   | `'.next/standalone'` | Standalone output directory, relative to the app or absolute              |
| `nextjs_server_path`    | `string`   | `'server.js'`        | Server entry relative to the standalone output root                       |
| `nextjs_upload_archive` | `boolean`  | `false`              | Compress the standalone directory into one tar.gz file before SCP upload  |
| `shared_files`          | `string[]` | `['.env']`           | Shared files linked into the release; existing configuration is preserved |

Example JSON configuration:

```json
{
  "$schema": "https://catapultjs.com/schema/deploy.schema.json",
  "version": 1,
  "recipes": ["nextjs_local", "systemd"],
  "store": {
    "systemd_service": "nextjs-web"
  },
  "after": {
    "deploy:publish": "systemd:restart"
  },
  "config": {
    "hosts": [
      {
        "name": "production",
        "ssh": "deploy@example.com",
        "deployPath": "/srv/nextjs"
      }
    ]
  }
}
```

Configure the process manager to run `node server.js` from `/srv/nextjs/current`.
For PM2, use `recipes/pm2` and an `ecosystem.config.cjs` whose working directory resolves
through `current` and whose script is `server.js`.

In a monorepo with `outputFileTracingRoot` set to the workspace root, the standalone server
may be nested. For an app at `apps/web`, set `nextjs_path` to `apps/web` and
`nextjs_server_path` to `apps/web/server.js`. The entire standalone tree is uploaded,
preserving dependencies above the app. Run `node apps/web/server.js` on the server.

Install local development dependencies before deploying. Build on a platform compatible
with the target server when dependencies include native binaries. Build-time environment
variables, including `NEXT_PUBLIC_*`, must be available locally. Configure runtime environment
variables through your process manager; linking `.env` does not inject it into systemd.

See the [Next.js standalone output documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Optional archive transfer

For standalone outputs with many files, enable archive transfer:

```json
{
  "store": {
    "nextjs_upload_archive": true
  }
}
```

The default remains recursive SCP. With this option, Catapult creates a temporary
`.tar.gz`, uploads that single file via SCP, extracts it into the release, and removes
the temporary archives locally and remotely, including on upload or extraction failure.
`tar` with gzip support must be available locally and on the server. No automatic
fallback is attempted if archiving fails. Native Windows environments without compatible
`tar` support can keep the default transfer.

The archive is created during `deploy:update_code`, so files added by tasks after
`deploy:build` are included. Application-specific packaging tasks can remain unchanged;
remove their archive creation commands and custom `deploy:update_code` override when
switching to this option.
