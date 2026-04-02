import type { Host, DeployContext, Paths, TaskName } from './types.ts'
import { q, getPaths, ssh } from './utils.ts'
import { colors } from '@poppinss/cliui'

export const yellow = (s: string) => colors.ansi().yellow(s)
export const blue = (s: string) => colors.ansi().blue(s)
export const gray = (s: string) => colors.ansi().dim(s)

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
  'git:check',
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

/** Retourne le contexte d'exécution courant. À utiliser dans les tâches async. */
export function getContext(): TaskContext {
  if (!_execCtx) throw new Error('getContext() must be called inside a task')
  return _execCtx
}

/**
 * Définit ou surcharge une tâche nommée.
 * Utilise cd() et run() pour envoyer des commandes SSH,
 * ou une fonction async pour des opérations plus complexes.
 */
export function task(name: TaskName, fn: TaskFn): void {
  _registry.set(name, fn)
}

/**
 * Change de répertoire sur le serveur distant.
 * Variables disponibles : {{release_path}}, {{current_path}},
 * {{shared_path}}, {{releases_path}}, {{base_path}}, {{release}}
 */
export function cd(path: string): void {
  if (!_execCtx) throw new Error('cd() must be called inside a task')
  _execCtx.commands.push(`cd ${q(_resolve(path))}`)
}

/**
 * Exécute une commande sur le serveur distant.
 * Les commandes sont regroupées en un seul appel SSH avec `set -e`.
 */
export function run(command: string): void {
  if (!_execCtx) throw new Error('run() must be called inside a task')
  _execCtx.commands.push(_resolve(command))
}

/** Exécute une tâche nommée pour un host donné. */
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

/** Insère une tâche avant une tâche existante dans le pipeline. */
export function before(existing: TaskName, newTask: TaskName): void {
  const idx = _pipeline.indexOf(existing)
  if (idx === -1) throw new Error(`Task "${existing}" not found in pipeline`)
  _pipeline.splice(idx, 0, newTask)
}

/** Insère une tâche après une tâche existante dans le pipeline. */
export function after(existing: TaskName, newTask: TaskName): void {
  const idx = _pipeline.indexOf(existing)
  if (idx === -1) throw new Error(`Task "${existing}" not found in pipeline`)
  _pipeline.splice(idx + 1, 0, newTask)
}

/** Retourne une copie du pipeline courant. */
export function getPipeline(): string[] {
  return [..._pipeline]
}

/** Vérifie si une tâche est enregistrée. */
export function hasTask(name: TaskName): boolean {
  return _registry.has(name)
}

/** Retourne la liste des tâches enregistrées. */
export function getTasks(): string[] {
  return [..._registry.keys()]
}

const _vars = new Map<string, unknown>()

/** Définit une variable de configuration accessible par les recettes. */
export function set(key: string, value: unknown): void {
  _vars.set(key, value)
}

/** Lit une variable de configuration. */
export function get<T>(key: string, defaultValue?: T): T {
  return (_vars.has(key) ? _vars.get(key) : defaultValue) as T
}

/** Retourne le chemin d'un binaire, configurable via set('bin/<name>', '/path/to/bin'). */
export function bin(name: string): string {
  return get(`bin/${name}`, name)
}

/** Retourne le binaire du package manager courant (npm, pnpm, yarn). */
export function pm(): string {
  return bin(get('package_manager', 'npm'))
}

/** Retourne la commande d'installation (frozen lockfile). */
export function pmInstall(): string {
  const manager: string = get('package_manager', 'npm')
  if (manager === 'pnpm') return `${pm()} install --frozen-lockfile`
  if (manager === 'yarn') return `${pm()} install --frozen-lockfile`
  return `${pm()} ci`
}

/** Retourne la commande d'installation en mode production. */
export function pmInstallProd(): string {
  const manager: string = get('package_manager', 'npm')
  if (manager === 'pnpm') return `${pm()} install --prod`
  if (manager === 'yarn') return `${pm()} install --production`
  return `${pm()} install --omit=dev`
}

/** Retire une tâche du pipeline. */
export function remove(name: TaskName): void {
  const idx = _pipeline.indexOf(name)
  if (idx === -1) throw new Error(`Task "${name}" not found in pipeline`)
  _pipeline.splice(idx, 1)
}

/** Remplace entièrement le pipeline. */
export function setPipeline(tasks: string[]): void {
  _pipeline = [...tasks]
}

type LifecycleHook = (ctx: DeployContext, host: Host) => Promise<void> | void

const _setupHooks: LifecycleHook[] = []

/** Enregistre une fonction à exécuter lors du deploy:setup, après l'initialisation des dossiers de base. */
export function onSetup(fn: LifecycleHook): void {
  _setupHooks.push(fn)
}

/** Retourne les hooks de setup enregistrés. */
export function getSetupHooks(): LifecycleHook[] {
  return [..._setupHooks]
}

const _statusHooks: LifecycleHook[] = []

/** Enregistre une fonction à exécuter lors de la commande status. */
export function onStatus(fn: LifecycleHook): void {
  _statusHooks.push(fn)
}

/** Retourne les hooks de status enregistrés. */
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
