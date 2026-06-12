# GitHub Actions with Catapult

Use the official `catapultjs/deploy-action` to run Catapult inside GitHub Actions. The action handles SSH setup, detects the package manager from the lockfile, installs dependencies, and runs the requested Catapult command.

Full docs: https://catapultjs.com/guide/ci-cd

## Minimal workflow

```yaml
name: Deploy

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: catapultjs/deploy-action@v0.5.0
        with:
          command: deploy
          config: deploy.ts
          private-key: ${{ secrets.DEPLOY_SSH_PRIVATE_KEY }}
          known-hosts: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
          version: latest
```

## Workflow with a custom runtime

Add `actions/setup-node` (or pnpm/bun setup) before the action when the project needs a specific Node version.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: npm

- uses: catapultjs/deploy-action@v0.5.0
  with:
    command: deploy
    config: deploy.ts
    private-key: ${{ secrets.DEPLOY_SSH_PRIVATE_KEY }}
    known-hosts: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
    version: latest
    working-directory: .
```

## Action inputs

| Name | Default | Description |
| --- | --- | --- |
| `command` | `deploy` | Catapult command to run (`deploy`, `rollback`, `task <name>`, etc.) |
| `config` | — | Path to the deploy config file |
| `args` | — | Extra CLI args, one per line |
| `package-manager` | auto-detected | `npm`, `pnpm`, `yarn`, or `bun` |
| `version` | `latest` | Version of `@catapultjs/deploy` to install |
| `working-directory` | `.` | Working directory relative to the repository root |

## SSH inputs

| Input | Required | Description |
| --- | --- | --- |
| `private-key` | Yes | SSH private key added to `ssh-agent` |
| `known-hosts` | Recommended | Content written to `~/.ssh/known_hosts` |
| `ssh-config` | No | Content written to `~/.ssh/config` |
| `insecure-ignore-host-key` | No | Disables strict host key checking |

## Reading sensitive config from environment variables

Keep SSH host and path out of `deploy.ts` by reading them from env vars, then passing them from the workflow:

```ts
// deploy.ts
const ssh = process.env.DEPLOY_SSH
const deployPath = process.env.DEPLOY_PATH
if (!ssh) throw new Error('Missing DEPLOY_SSH')
if (!deployPath) throw new Error('Missing DEPLOY_PATH')

export default defineConfig({
  hosts: [{ name: 'production', ssh, deployPath, branch: process.env.DEPLOY_BRANCH || 'main' }],
})
```

```yaml
- uses: catapultjs/deploy-action@v0.5.0
  with:
    command: deploy
    private-key: ${{ secrets.DEPLOY_SSH_PRIVATE_KEY }}
    known-hosts: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
  env:
    DEPLOY_SSH: ${{ secrets.DEPLOY_SSH }}
    DEPLOY_PATH: ${{ vars.DEPLOY_PATH }}
    DEPLOY_BRANCH: main
    DEPLOY_USER: ${{ github.actor }}
```

Use GitHub **Secrets** for sensitive values (SSH key, host string) and **Variables** for non-sensitive ones (deploy path). `DEPLOY_USER` is picked up by `deploy:log_revision` when `git config user.name` is unavailable on the runner.
