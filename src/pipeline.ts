import type { TaskName } from './types.ts'
import { PipelineStore } from './pipeline/store.ts'
import { hooks, type LifecycleHook, type ConfigHook } from './pipeline/hooks.ts'

export { hooks }

export type { LifecycleHook, ConfigHook } from './pipeline/hooks.ts'

const pipeline = new PipelineStore()

let immediate = false
const queue: Array<() => void> = []

function defer(fn: () => void): void {
  if (immediate) fn()
  else queue.push(fn)
}

/** @internal — switches between immediate and deferred execution for after/before/remove. */
export function setImmediatePipeline(value: boolean): void {
  immediate = value
}

/** @internal — executes all queued after/before/remove calls. */
export function flushPipelineQueue(): void {
  for (const fn of queue) fn()
  queue.length = 0
}

/** Returns a copy of the current pipeline. */
export function getPipeline(): string[] {
  return pipeline.get()
}

/** Replaces the entire pipeline. Marks it as user-managed — onConfig hooks will not run. */
export function setPipeline(tasks: TaskName[]): void {
  pipeline.set(tasks)
}

/** @internal — initialises the default pipeline without marking it as user-managed. */
export function initPipeline(tasks: TaskName[]): void {
  pipeline.init(tasks)
}

/** Returns true if the pipeline was explicitly set by the user via setPipeline(). */
export function isPipelineLocked(): boolean {
  return pipeline.isLocked()
}

/** Inserts a task before an existing one in the pipeline. */
export function before(existing: TaskName, newTask: TaskName): void {
  defer(() => pipeline.before(existing, newTask))
}

/** Inserts a task after an existing one in the pipeline. */
export function after(existing: TaskName, newTask: TaskName): void {
  defer(() => pipeline.after(existing, newTask))
}

/** Returns true if the task is present in the pipeline. */
export function inPipeline(name: TaskName): boolean {
  return pipeline.has(name)
}

/** Removes a task from the pipeline. */
export function remove(name: TaskName): void {
  defer(() => pipeline.remove(name))
}

/** Registers a function to run during deploy:setup, after base directories are initialized. */
export function onSetup(fn: LifecycleHook): void {
  hooks.addSetup(fn)
}

/** Registers a function to run during the status command. */
export function onStatus(fn: LifecycleHook): void {
  hooks.addStatus(fn)
}

/** Registers a function called synchronously inside defineConfig(), after the pipeline is adjusted for the active strategy. */
export function onConfig(fn: ConfigHook): void {
  hooks.addConfig(fn)
}
