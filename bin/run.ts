#!/usr/bin/env node

import { pathToFileURL } from 'url'
import { findDeployFile } from '../src/utils.ts'
import { Kernel, ListLoader, HelpCommand } from '@adonisjs/ace'
import Version from '../commands/version.js'
import Init from '../commands/init.js'
import Setup from '../commands/setup.js'
import Deploy from '../commands/deploy.js'
import Rollback from '../commands/rollback.js'
import Status from '../commands/status.js'
import ListReleases from '../commands/list_releases.js'
import ListTasks from '../commands/list_tasks.js'
import ListPipeline from '../commands/list_pipeline.js'
import RunTask from '../commands/run_task.js'

const skipDeployFile = ['init', 'version'].includes(process.argv[2])

if (!skipDeployFile) {
  const deployFile = await findDeployFile()

  if (!deployFile) {
    console.error(
      'No deploy.ts or deploy.js found in current directory. Run `npx cata init` to create one.'
    )
    process.exit(1)
  }

  await import(pathToFileURL(deployFile).href)
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
    ListPipeline,
    RunTask,
  ])
)

/**
 * Handing over the process to the Ace kernel
 */
await kernel.handle(process.argv.splice(2))
