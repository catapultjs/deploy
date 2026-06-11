---
description: Why Catapult exists, the story behind a Capistrano-style deployment tool for Node.js.
---

# Motivation

## The problem

Deploying a Node.js application directly to a server is a common need. Tools like [Capistrano](https://capistranorb.com/) (Ruby) and [Deployer](https://deployer.org/) (PHP) have solved this problem well for their ecosystems for years: versioned releases, shared directories, automatic rollback, composable tasks.

The Node.js ecosystem had no real equivalent.

## PM2 deploy

For a while, [PM2 deploy](https://pm2.keymetrics.io/docs/usage/deployment/) filled that gap. It handles the basics: SSH into a server, pull the code, restart the process. But it comes with limitations that become apparent quickly:

- Configuration lives inside `ecosystem.config.cjs`, mixed with process management config
- No control over the number of releases to keep
- The pipeline is fixed, with no way to insert custom steps

## What Catapult is

Catapult is a Capistrano-style deployment tool for Node.js. It brings the same concepts (releases, shared directories, task pipeline, automatic rollback) to a TypeScript/JavaScript project, with no Ruby or PHP required.

It works over plain SSH. No agent to install on the server, no daemon to manage, no cloud dependency. Just a `deploy.ts` file in your project and an SSH key.

The pipeline is fully composable: add tasks, remove them, override built-in ones, or replace the whole sequence. Recipes handle common stacks (AdonisJS, PM2, rsync, git) and can be mixed freely.
