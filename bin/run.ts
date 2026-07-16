#!/usr/bin/env node

import { loadDeployConfig } from '../src/config/loader.ts'
import { Context } from '../src/context.ts'
import { logger } from '../src/logger.ts'
import { Verbose } from '../src/enums.ts'
import { Kernel, ListLoader, HelpCommand } from '@adonisjs/ace'
import Version from '../commands/version.ts'
import Init from '../commands/init.ts'
import Setup from '../commands/setup.ts'
import Deploy from '../commands/deploy.ts'
import Rollback from '../commands/rollback.ts'
import Status from '../commands/status.ts'
import ListReleases from '../commands/list_releases.ts'
import ListRevisions from '../commands/list_revisions.ts'
import ListTasks from '../commands/list_tasks.ts'
import Pipeline from '../commands/pipeline.ts'
import RunTask from '../commands/run_task.ts'
import Ssh from '../commands/ssh.ts'
import Run from '../commands/run.ts'
import ConfigValidate from '../commands/config_validate.ts'
import { resolveDeployConfigFile } from '../src/config/resolve.ts'

const cliArgs = process.argv.slice(2)

function parseVerboseLevel(argv: string[]): Verbose {
  let count = 0
  for (const arg of argv) {
    if (arg === '--verbose' || arg === '-v') count++
    else if (/^-v{2,}$/.test(arg)) count += arg.length - 1
  }
  return Math.min(count, Verbose.DEBUG) as Verbose
}

const skipDeployFile = ['init', 'version', 'config:validate'].includes(cliArgs[0])

if (!skipDeployFile) {
  try {
    const deployFile = await resolveDeployConfigFile(cliArgs)
    const initialize = await loadDeployConfig(deployFile)
    await initialize()
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const verboseLevel = parseVerboseLevel(cliArgs)
  if (verboseLevel > Verbose.SILENT) Context.get().config.verbose = verboseLevel
}

//

const kernel = Kernel.create()

kernel.defineFlag('help', {
  type: 'boolean',
  description: HelpCommand.description,
})

kernel.defineFlag('config', {
  type: 'string',
  alias: 'c',
  description: 'Path to the deploy config file (default: auto-detected)',
})

kernel.defineFlag('json', {
  type: 'boolean',
  description: 'Output result as JSON when supported by the command',
})

kernel.on('help', async (command, $kernel, parsed) => {
  parsed.args.unshift(command.commandName)
  const help = new HelpCommand($kernel, parsed, kernel.ui, kernel.prompt)
  await help.exec()
  return $kernel.shortcircuit()
})

kernel.addLoader(
  new ListLoader([
    Version,
    Init,
    Setup,
    Deploy,
    Rollback,
    Status,
    ListReleases,
    ListRevisions,
    ListTasks,
    Pipeline,
    ConfigValidate,
    RunTask,
    Ssh,
    Run,
  ])
)

await kernel.handle(cliArgs)
process.exitCode = kernel.exitCode ?? 0
