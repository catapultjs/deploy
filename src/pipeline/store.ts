import type { TaskName } from '../types.ts'

export class PipelineStore {
  #pipeline: string[] = [
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

  get(): string[] {
    return [...this.#pipeline]
  }

  set(tasks: TaskName[]): void {
    this.#pipeline = [...tasks]
  }

  before(existing: TaskName, newTask: TaskName): void {
    const idx = this.#pipeline.indexOf(existing)
    if (idx === -1) throw new Error(`Task "${existing}" not found in pipeline`)
    this.#pipeline.splice(idx, 0, newTask)
  }

  after(existing: TaskName, newTask: TaskName): void {
    const idx = this.#pipeline.indexOf(existing)
    if (idx === -1) throw new Error(`Task "${existing}" not found in pipeline`)
    this.#pipeline.splice(idx + 1, 0, newTask)
  }

  remove(name: TaskName): void {
    const idx = this.#pipeline.indexOf(name)
    if (idx === -1) throw new Error(`Task "${name}" not found in pipeline`)
    this.#pipeline.splice(idx, 1)
  }
}
