# Astro example

This example shows how to deploy an Astro site with Catapult.

## Deploy files

### `deploy.js`

This file uses the `astro` recipe. It builds the Astro project locally with `astro build`, then uploads the generated `dist/` directory to the server.

By default, the upload uses SCP because `recipes/astro` overrides `deploy:update_code` itself.

The commented lines show two common adjustments:

- import `@catapultjs/deploy/recipes/rsync` if you want to keep the local Astro build but replace SCP with rsync
- set `source_path` if you want to upload a directory other than the default `./dist/.`

Use this example when you want the server to receive built static files instead of the project source code.
