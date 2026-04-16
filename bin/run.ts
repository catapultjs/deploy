#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { findDeployFile } from '../src/utils.ts'
import { Context } from '../src/context.ts'
import { logger } from '../src/logger.ts'
import { Kernel, ListLoader, HelpCommand } from '@adonisjs/ace'
import Version from '../commands/version.js'
import Init from '../commands/init.js'
import Setup from '../commands/setup.js'
import Deploy from '../commands/deploy.js'
import Rollback from '../commands/rollback.js'
import Status from '../commands/status.js'
import ListReleases from '../commands/list_releases.js'
import ListTasks from '../commands/list_tasks.js'
import Pipeline from '../commands/pipeline.js'
import RunTask from '../commands/run_task.js'
import Ssh from '../commands/ssh.js'
import Run from '../commands/run.js'

function parseVerboseLevel(argv: string[]): 0 | 1 | 2 {
  let count = 0
  for (const arg of argv) {
    if (arg === '--verbose' || arg === '-v') count++
    else if (/^-v{2,}$/.test(arg)) count += 2
  }
  return Math.min(count, 2) as 0 | 1 | 2
}

const skipDeployFile = ['init', 'version'].includes(process.argv[2])

if (!skipDeployFile) {
  const deployFile = await findDeployFile()

  if (!deployFile) {
    logger.error(
      'No deploy.ts or deploy.js found in current directory. Run `npx cata init` to create one.'
    )
    process.exit(1)
  }

  const mod = await import(pathToFileURL(deployFile).href)
  await mod.default()

  const verboseLevel = parseVerboseLevel(process.argv.slice(2))
  if (verboseLevel > 0) Context.get().config.verbose = verboseLevel
}

//

const kernel = Kernel.create()

/**
 * Register a global --help flag
 */
kernel.defineFlag('help', {
  type: 'boolean',
  description: HelpCommand.description,
})

/**
 * Listen for the presence of --help flag and execute the HelpCommand.
 * Make sure to return the result of `$kernel.shortcircuit()`
 */
kernel.on('help', async (command, $kernel, parsed) => {
  parsed.args.unshift(command.commandName)
  const help = new HelpCommand($kernel, parsed, kernel.ui, kernel.prompt)
  await help.exec()
  return $kernel.shortcircuit()
})

/**
 * Register a global --ansi flag
 */
kernel.defineFlag('ansi', {
  type: 'boolean',
  showNegatedVariantInHelp: true,
  description: 'Force enable or disable colored output',
})

/**
 * Listen for the presence of --ansi flag and disable/enable the colored
 * output.
 */
kernel.on('ansi', async (_, $kernel, parsed) => {
  if (parsed.flags.ansi === false) {
    $kernel.ui.switchMode('silent')
  }

  if (parsed.flags.ansi === true) {
    $kernel.ui.switchMode('normal')
  }
})

/**
 * Using the List loader to register our command
 */
kernel.addLoader(
  new ListLoader([
    Version,
    Init,
    Setup,
    Deploy,
    Rollback,
    Status,
    ListReleases,
    ListTasks,
    Pipeline,
    RunTask,
    Ssh,
    Run,
  ])
)

/**
 * Handing over the process to the Ace kernel
 */
await kernel.handle(process.argv.splice(2))
