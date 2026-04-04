import type { Host, DeployContext, TaskName } from './types.ts'
import { type TaskFn, TaskRunner } from './task/runner.ts'
import { TaskStore } from './task/store.ts'
import { q } from './utils.ts'

export type { TaskContext } from './task/runner.ts'

const runner = new TaskRunner()
const store = new TaskStore(runner)

export function task(name: TaskName, fn: TaskFn): void {
  store.register(name, fn)
}

export function hasTask(name: TaskName): boolean {
  return store.has(name)
}

export function getTasks(): string[] {
  return store.list()
}

export async function runTask(name: TaskName, deployCtx: DeployContext, host: Host): Promise<void> {
  return store.run(name, deployCtx, host)
}

// ---------------------------------------------------------------------------
// Task DSL
// ---------------------------------------------------------------------------

export function cd(path: string): void {
  runner.push(`cd ${q(runner.resolve(path))}`)
}

export function run(command: string): void {
  runner.push(runner.resolve(command))
}

export function bin(name: string): string {
  return runner.bin(name)
}

export function isVerbose(): boolean {
  return runner.isVerbose()
}
