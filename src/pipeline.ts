import type { TaskName } from './types.ts'
import { PipelineStore } from './pipeline/store.ts'
import { hooks, type LifecycleHook } from './pipeline/hooks.ts'

export type { LifecycleHook } from './pipeline/hooks.ts'

const pipeline = new PipelineStore()

/** Returns a copy of the current pipeline. */
export function getPipeline(): string[] {
  return pipeline.get()
}

/** Replaces the entire pipeline. */
export function setPipeline(tasks: TaskName[]): void {
  pipeline.set(tasks)
}

/** Inserts a task before an existing one in the pipeline. */
export function before(existing: TaskName, newTask: TaskName): void {
  pipeline.before(existing, newTask)
}

/** Inserts a task after an existing one in the pipeline. */
export function after(existing: TaskName, newTask: TaskName): void {
  pipeline.after(existing, newTask)
}

/** Removes a task from the pipeline. */
export function remove(name: TaskName): void {
  pipeline.remove(name)
}

/** Registers a function to run during deploy:setup, after base directories are initialized. */
export function onSetup(fn: LifecycleHook): void {
  hooks.addSetup(fn)
}

/** Registers a function to run during the status command. */
export function onStatus(fn: LifecycleHook): void {
  hooks.addStatus(fn)
}
