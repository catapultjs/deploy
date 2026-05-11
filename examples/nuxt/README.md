# Nuxt example

This example shows two deployment strategies for a Nuxt application with Catapult.

## Deploy files

### `deploy.ts`

This file deploys the Nuxt application source code with `rsync`, then runs the Nuxt build on the server with the `nuxt` recipe.

Use this version when the remote server should install dependencies and build the app itself.

### `deploy.static.ts`

This file is for a static deployment. It runs `nuxt generate` locally before deployment, then uploads the generated `dist/` directory with `rsync`.

This version does not deploy the full application source code. It only sends the generated static files to the server.

Use this version when you want to generate the site locally and publish the static output.
