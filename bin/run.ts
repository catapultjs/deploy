#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { access } from 'node:fs/promises'
import { findDeployFile } from '../src/utils.ts'
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

function parseVerboseLevel(argv: string[]): Verbose {
  let count = 0
  for (const arg of argv) {
    if (arg === '--verbose' || arg === '-v') count++
    else if (/^-v{2,}$/.test(arg)) count += arg.length - 1
  }
  return Math.min(count, Verbose.DEBUG) as Verbose
}

function parseConfigFlag(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--config' || argv[i] === '-c') && argv[i + 1]) {
      return argv[i + 1]
    }
  }
  return null
}

const skipDeployFile = ['init', 'version'].includes(process.argv[2])

if (!skipDeployFile) {
  const configFlag = parseConfigFlag(process.argv.slice(2))
  let deployFile: string | null = null

  if (configFlag) {
    const resolved = resolve(process.cwd(), configFlag)
    try {
      await access(resolved)
      deployFile = resolved
    } catch {
      logger.error(`Config file not found: ${configFlag}`)
      process.exit(1)
    }
  } else {
    deployFile = await findDeployFile()
  }

  if (!deployFile) {
    logger.error(
      'No supported deploy config file found in current directory. Run `npx cata init` to create one.'
    )
    process.exit(1)
  }

  const mod = await import(pathToFileURL(deployFile).href)
  await mod.default()

  const verboseLevel = parseVerboseLevel(process.argv.slice(2))
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
    RunTask,
    Ssh,
    Run,
  ])
)

await kernel.handle(process.argv.splice(2))
process.exitCode = kernel.exitCode ?? 0
