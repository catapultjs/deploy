# VitePress example

This example shows how to deploy a VitePress site with Catapult.

## Deploy files

### `deploy.ts`

This file uses the `vitepress` recipe. It runs `vitepress build` locally, then uploads the generated `.vitepress/dist` directory to the server.

Use this example when you want Catapult to build the documentation site on your local machine and publish only the generated static files.
