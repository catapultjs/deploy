import type { Host, DeployContext, Paths, TaskName } from './types.ts'
import { q, getPaths, ssh, yellow, blue, gray } from './utils.ts'

export { yellow, blue, gray }

export type TaskFn = () => void | Promise<void>

export interface TaskContext {
  host: Host
  paths: Paths
  deployCtx: DeployContext
}

interface ExecCtx extends TaskContext {
  commands: string[]
}

const _registry = new Map<string, TaskFn>()

let _pipeline: string[] = [
  'deploy:lock',
  'deploy:release',
  'deploy:update_code',
  'deploy:shared',
  'deploy:publish',
  'deploy:log_revision',
  'deploy:healthcheck',
  'deploy:unlock',
  'deploy:cleanup',
]

let _execCtx: ExecCtx | null = null

/** Returns the current execution context. Must be called inside a task. */
export function getContext(): TaskContext {
  if (!_execCtx) throw new Error('getContext() must be called inside a task')
  return _execCtx
}

/**
 * Defines or overrides a named task.
 * Use cd() and run() to send SSH commands,
 * or an async function for more complex operations.
 */
export function task(name: TaskName, fn: TaskFn): void {
  _registry.set(name, fn)
}

/**
 * Changes directory on the remote server.
 * Available variables: {{release_path}}, {{current_path}},
 * {{shared_path}}, {{releases_path}}, {{base_path}}, {{release}}
 */
export function cd(path: string): void {
  if (!_execCtx) throw new Error('cd() must be called inside a task')
  _execCtx.commands.push(`cd ${q(_resolve(path))}`)
}

/**
 * Runs a command on the remote server.
 * Commands are batched into a single SSH call with `set -e`.
 */
export function run(command: string): void {
  if (!_execCtx) throw new Error('run() must be called inside a task')
  _execCtx.commands.push(_resolve(command))
}

/** Runs a named task for a given host. */
export async function runTask(name: TaskName, deployCtx: DeployContext, host: Host): Promise<void> {
  const fn = _registry.get(name)
  if (!fn) throw new Error(`Task not found: "${name}"`)

  const paths = getPaths(host.deployPath, deployCtx.release)
  _execCtx = { host, paths, deployCtx, commands: [] }

  try {
    const result = fn()
    if (result instanceof Promise) await result
    await _flush()
  } finally {
    _execCtx = null
  }
}

/** Inserts a task before an existing one in the pipeline. */
export function before(existing: TaskName, newTask: TaskName): void {
  const idx = _pipeline.indexOf(existing)
  if (idx === -1) throw new Error(`Task "${existing}" not found in pipeline`)
  _pipeline.splice(idx, 0, newTask)
}

/** Inserts a task after an existing one in the pipeline. */
export function after(existing: TaskName, newTask: TaskName): void {
  const idx = _pipeline.indexOf(existing)
  if (idx === -1) throw new Error(`Task "${existing}" not found in pipeline`)
  _pipeline.splice(idx + 1, 0, newTask)
}

/** Returns a copy of the current pipeline. */
export function getPipeline(): string[] {
  return [..._pipeline]
}

/** Checks whether a task is registered. */
export function hasTask(name: TaskName): boolean {
  return _registry.has(name)
}

/** Returns the list of registered task names. */
export function getTasks(): string[] {
  return [..._registry.keys()]
}

const _vars = new Map<string, unknown>()

/** Sets a configuration variable accessible from recipes. */
export function set(key: string, value: unknown): void {
  _vars.set(key, value)
}

/** Reads a configuration variable. */
export function get<T>(key: string, defaultValue?: T): T {
  return (_vars.has(key) ? _vars.get(key) : defaultValue) as T
}

/** Returns the path to a binary. Checks the current host's bin config first, then falls back to the binary name. */
export function bin(name: string): string {
  return _execCtx?.host.bin?.[name] ?? name
}

/** Returns the current package manager binary (npm, pnpm, yarn). */
export function pm(): string {
  return bin(get('package_manager', 'npm'))
}

/** Returns the install command with frozen lockfile. */
export function pmInstall(): string {
  const manager: string = get('package_manager', 'npm')
  if (manager === 'pnpm') return `${pm()} install --frozen-lockfile`
  if (manager === 'yarn') return `${pm()} install --frozen-lockfile`
  return `${pm()} ci`
}

/** Returns the production-only install command. */
export function pmInstallProd(): string {
  const manager: string = get('package_manager', 'npm')
  if (manager === 'pnpm') return `${pm()} install --prod`
  if (manager === 'yarn') return `${pm()} install --production`
  return `${pm()} install --omit=dev`
}

/** Removes a task from the pipeline. */
export function remove(name: TaskName): void {
  const idx = _pipeline.indexOf(name)
  if (idx === -1) throw new Error(`Task "${name}" not found in pipeline`)
  _pipeline.splice(idx, 1)
}

/** Replaces the entire pipeline. */
export function setPipeline(tasks: TaskName[]): void {
  _pipeline = [...tasks]
}

type LifecycleHook = (ctx: DeployContext, host: Host) => Promise<void> | void

const _setupHooks: LifecycleHook[] = []

/** Registers a function to run during deploy:setup, after base directories are initialized. */
export function onSetup(fn: LifecycleHook): void {
  _setupHooks.push(fn)
}

/** Returns the registered setup hooks. */
export function getSetupHooks(): LifecycleHook[] {
  return [..._setupHooks]
}

const _statusHooks: LifecycleHook[] = []

/** Registers a function to run during the status command. */
export function onStatus(fn: LifecycleHook): void {
  _statusHooks.push(fn)
}

/** Returns the registered status hooks. */
export function getStatusHooks(): LifecycleHook[] {
  return [..._statusHooks]
}

function _resolve(str: string): string {
  if (!_execCtx) return str
  const p = _execCtx.paths
  return str
    .replace(/\{\{release_path\}\}/g, p.release)
    .replace(/\{\{current_path\}\}/g, p.current)
    .replace(/\{\{shared_path\}\}/g, p.shared)
    .replace(/\{\{releases_path\}\}/g, p.releases)
    .replace(/\{\{base_path\}\}/g, p.base)
    .replace(/\{\{release\}\}/g, _execCtx.deployCtx.release)
}

export function isVerbose(): boolean {
  return _execCtx?.deployCtx.config.verbose ?? false
}

async function _flush(): Promise<void> {
  if (!_execCtx || _execCtx.commands.length === 0) return
  const cmds = _execCtx.commands.splice(0)
  const verbose = _execCtx.deployCtx.config.verbose
  if (verbose) {
    for (const cmd of cmds) console.log(yellow(`    $ ${cmd}`))
  }
  await ssh(_execCtx.host, ['set -e', ...cmds].join('\n'))
}
