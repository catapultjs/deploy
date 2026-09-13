# VitePress example

This example shows how to deploy a VitePress site with Catapult.

## Deploy files

### `deploy.ts`

This file uses the `vitepress` and `caddy` recipes. It runs `vitepress build` locally, uploads the generated `.vitepress/dist` directory to the server, then reloads Caddy after `deploy:publish`.

The recipes use static imports. Add `after('deploy:publish', 'caddy:reload')` explicitly to reload Caddy after publishing. The JSON example uses the equivalent `"after": { "deploy:publish": "caddy:reload" }` declaration.

Use this example when you want Catapult to build the documentation site on your local machine and publish only the generated static files.
