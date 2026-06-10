import type { TaskName } from './types.ts'
import { PipelineStore } from './pipeline/store.ts'
import { hooks, type LifecycleHook, type StatusHook } from './pipeline/hooks.ts'

export { hooks }

export type { LifecycleHook, StatusHook, StatusData } from './pipeline/hooks.ts'

const pipeline = new PipelineStore()

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

/** Inserts a task before an existing one in the pipeline. */
export function before(existing: TaskName, newTask: TaskName): void {
  pipeline.before(existing, newTask)
}

/** Inserts a task after an existing one in the pipeline. */
export function after(existing: TaskName, newTask: TaskName): void {
  pipeline.after(existing, newTask)
}

/** Returns true if the task is present in the pipeline. */
export function inPipeline(name: TaskName): boolean {
  return pipeline.has(name)
}

/** Removes a task from the pipeline. */
export function remove(name: TaskName): void {
  pipeline.remove(name)
}

/** Registers a function to run during deploy:setup, after base directories are initialized. */
export function onSetup(fn: LifecycleHook): void {
  hooks.addSetup(fn)
}

/**
 * Registers a function to run during the status command.
 * Data returned as an object is printed as key/value lines and merged
 * into the host entry of `status --json`; logger output only appears
 * in text mode.
 */
export function onStatus(fn: StatusHook): void {
  hooks.addStatus(fn)
}
