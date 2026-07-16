import { readFile } from 'node:fs/promises'
import { Ajv, type ErrorObject } from 'ajv'
import { before, after, remove, setPipeline, getPipeline } from '../../pipeline.ts'
import { cd, desc, download, hasTask, local, run, task, upload } from '../../task.ts'
import { set } from '../../store.ts'
import { defineConfig } from '../../define_config.ts'
import {
  deployJsonSchema,
  type JsonDeployConfig,
  type JsonPipelinePlacement,
  type JsonTaskDefinition,
  type JsonTaskStep,
} from './schema.ts'
import { loadBuiltInRecipe } from './recipe_registry.ts'

const ajv = new Ajv({ allErrors: true, strict: true })
const validateSchema = ajv.compile<JsonDeployConfig>(deployJsonSchema)

function pointerSegment(value: unknown): string {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1')
}

function errorPath(error: ErrorObject): string {
  let path = error.instancePath

  if (error.keyword === 'required') {
    path += `/${pointerSegment(error.params.missingProperty)}`
  } else if (error.keyword === 'additionalProperties') {
    path += `/${pointerSegment(error.params.additionalProperty)}`
  } else if (error.keyword === 'propertyNames') {
    path += `/${pointerSegment(error.params.propertyName)}`
  }

  return path || '/'
}

function formatValidationError(error: ErrorObject): string {
  return `${errorPath(error)} ${error.message ?? 'is invalid'}`
}

function validateHostNames(config: JsonDeployConfig): void {
  const names = new Set<string>()
  for (const host of config.config.hosts) {
    if (names.has(host.name)) {
      throw new Error(`Invalid JSON deploy config: duplicate host name "${host.name}"`)
    }
    names.add(host.name)
  }
}

export function validateJsonConfig(value: unknown): JsonDeployConfig {
  if (!validateSchema(value)) {
    const details = (validateSchema.errors ?? []).map(formatValidationError).join('\n')
    throw new Error(`Invalid JSON deploy config:\n${details}`)
  }

  const config = value as JsonDeployConfig
  validateHostNames(config)
  return config
}

export function parseJsonConfig(contents: string, source: string): JsonDeployConfig {
  let value: unknown

  try {
    value = JSON.parse(contents.replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`Unable to parse JSON deploy config "${source}": ${(error as Error).message}`)
  }

  try {
    return validateJsonConfig(value)
  } catch (error) {
    throw new Error(`${(error as Error).message}\nConfig file: ${source}`)
  }
}

function stepsFor(definition: JsonTaskDefinition): JsonTaskStep[] {
  return Array.isArray(definition) ? definition : definition.steps
}

async function executeStep(step: JsonTaskStep): Promise<void> {
  if ('cd' in step) {
    cd(step.cd)
  } else if ('run' in step) {
    run(step.run)
  } else if ('local' in step) {
    await local(step.local.command, { cwd: step.local.cwd })
  } else if ('upload' in step) {
    await upload(step.upload.local, step.upload.remote)
  } else {
    await download(step.download.remote, step.download.local)
  }
}

function registerTasks(tasks: Record<string, JsonTaskDefinition> = {}): void {
  for (const [name, definition] of Object.entries(tasks)) {
    if (!Array.isArray(definition) && definition.description) {
      desc(definition.description)
    }

    task(name, async () => {
      for (const step of stepsFor(definition)) {
        await executeStep(step)
      }
    })
  }
}

function assertRegistered(name: string, path: string): void {
  if (!hasTask(name)) {
    throw new Error(`Invalid JSON deploy config at ${path}: task "${name}" is not registered`)
  }
}

function applyPipelineMutation(path: string, operation: () => void): void {
  try {
    operation()
  } catch (error) {
    throw new Error(`Invalid JSON deploy config at ${path}: ${(error as Error).message}`)
  }
}

function placementTasks(value: string | string[]): string[] {
  return typeof value === 'string' ? [value] : value
}

function placementTaskPath(
  position: 'before' | 'after',
  target: string,
  value: string | string[],
  index: number
): string {
  const path = `/${position}/${pointerSegment(target)}`
  return Array.isArray(value) ? `${path}/${index}` : path
}

function validatePlacements(config: JsonDeployConfig): void {
  const targets = new Set([...Object.keys(config.before ?? {}), ...Object.keys(config.after ?? {})])
  const removed = new Set(config.remove ?? [])
  const placed = new Map<string, string>()

  for (const position of ['before', 'after'] as const) {
    for (const [target, value] of Object.entries(config[position] ?? {})) {
      for (const [index, name] of placementTasks(value).entries()) {
        const path = placementTaskPath(position, target, value, index)
        const previousPath = placed.get(name)

        if (previousPath) {
          throw new Error(
            `Invalid JSON deploy config at ${path}: task "${name}" is already placed at ${previousPath}`
          )
        }
        if (targets.has(name)) {
          throw new Error(
            `Invalid JSON deploy config at ${path}: task "${name}" cannot also be a before/after target`
          )
        }
        if (removed.has(name)) {
          throw new Error(
            `Invalid JSON deploy config at ${path}: task "${name}" cannot be both placed and removed`
          )
        }

        placed.set(name, path)
      }
    }
  }
}

function applyPlacements(
  position: 'before' | 'after',
  placements: JsonPipelinePlacement = {}
): void {
  for (const [target, value] of Object.entries(placements)) {
    const tasks = placementTasks(value)
    const path = `/${position}/${pointerSegment(target)}`

    for (const [index, name] of tasks.entries()) {
      const taskPath = placementTaskPath(position, target, value, index)
      assertRegistered(name, taskPath)
    }

    const orderedTasks = position === 'after' ? [...tasks].reverse() : tasks
    applyPipelineMutation(path, () => {
      for (const name of orderedTasks) {
        if (position === 'before') before(target, name)
        else after(target, name)
      }
    })
  }
}

function applyPipelineConfig(config: JsonDeployConfig): void {
  validatePlacements(config)

  if (config.pipeline !== undefined) {
    for (const [index, name] of config.pipeline.entries()) {
      assertRegistered(name, `/pipeline/${index}`)
    }
    setPipeline(config.pipeline)
  }

  for (const [index, name] of (config.remove ?? []).entries()) {
    applyPipelineMutation(`/remove/${index}`, () => remove(name))
  }

  applyPlacements('before', config.before)
  applyPlacements('after', config.after)
}

function validateFinalPipeline(): void {
  const pipeline = getPipeline()
  if (pipeline.length === 0) {
    throw new Error(
      'Invalid JSON deploy config at /pipeline: final pipeline must contain at least one task'
    )
  }

  for (const [index, name] of pipeline.entries()) {
    assertRegistered(name, `/pipeline/${index}`)
  }
}

function applyStore(values: JsonDeployConfig['store']): void {
  for (const [key, value] of Object.entries(values ?? {})) set(key, value)
}

export async function loadJsonConfig(filePath: string): Promise<() => Promise<void>> {
  const contents = await readFile(filePath, 'utf8')
  const json = parseJsonConfig(contents, filePath)

  applyStore(json.store)
  for (const recipe of json.recipes ?? []) {
    try {
      await loadBuiltInRecipe(recipe)
    } catch (error) {
      throw new Error(`Unable to load recipe "${recipe}": ${(error as Error).message}`)
    }
  }
  applyStore(json.store)

  registerTasks(json.tasks)
  applyPipelineConfig(json)
  validateFinalPipeline()

  const initialize = defineConfig(json.config)
  return async () => {
    await initialize()
    validateFinalPipeline()
  }
}
