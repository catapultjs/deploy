# VitePress example

This example shows how to deploy a VitePress site with Catapult.

## Deploy files

### `deploy.ts`

This file uses the `vitepress` and `caddy` recipes. It runs `vitepress build` locally, uploads the generated `.vitepress/dist` directory to the server, then reloads Caddy after `deploy:publish`.

The recipes are loaded with dynamic imports so `caddy_reload_after_publish` is set before the Caddy recipe wires `caddy:reload` into the pipeline.

Use this example when you want Catapult to build the documentation site on your local machine and publish only the generated static files.
