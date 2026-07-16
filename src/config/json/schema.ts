import type { Config } from '../../types.ts'
import type { AnySchemaObject } from 'ajv'
import { BUILT_IN_RECIPE_NAMES, type BuiltInRecipeName } from './recipe_registry.ts'

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type JsonTaskStep =
  | { cd: string }
  | { run: string }
  | { local: { command: string; cwd?: string } }
  | { upload: { local: string; remote: string } }
  | { download: { remote: string; local: string } }

export interface JsonTask {
  description?: string
  steps: JsonTaskStep[]
}

export type JsonTaskDefinition = JsonTaskStep[] | JsonTask

export type JsonPipelinePlacement = Record<string, string | string[]>

export interface JsonDeployConfig {
  $schema?: string
  version: 1
  recipes?: BuiltInRecipeName[]
  config: Omit<Config, 'hooks'>
  store?: Record<string, JsonValue>
  tasks?: Record<string, JsonTaskDefinition>
  pipeline?: string[]
  before?: JsonPipelinePlacement
  after?: JsonPipelinePlacement
  remove?: string[]
}

const nonEmptyString: AnySchemaObject = { type: 'string', minLength: 1 }
const taskName: AnySchemaObject = { type: 'string', minLength: 1, pattern: '^\\S+$' }
const stringValue: AnySchemaObject = { type: 'string' }
const stringArray: AnySchemaObject = {
  type: 'array',
  items: nonEmptyString,
}
const taskNames: AnySchemaObject = {
  oneOf: [
    taskName,
    {
      type: 'array',
      items: taskName,
      minItems: 1,
      uniqueItems: true,
    },
  ],
}
const taskPlacements: AnySchemaObject = {
  type: 'object',
  propertyNames: taskName,
  additionalProperties: taskNames,
}

const exactObject = (
  properties: Record<string, AnySchemaObject>,
  required: string[]
): AnySchemaObject => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

const taskStepSchemas: AnySchemaObject[] = [
  exactObject({ cd: nonEmptyString }, ['cd']),
  exactObject({ run: nonEmptyString }, ['run']),
  exactObject(
    {
      local: exactObject(
        {
          command: nonEmptyString,
          cwd: nonEmptyString,
        },
        ['command']
      ),
    },
    ['local']
  ),
  exactObject(
    {
      upload: exactObject(
        {
          local: nonEmptyString,
          remote: nonEmptyString,
        },
        ['local', 'remote']
      ),
    },
    ['upload']
  ),
  exactObject(
    {
      download: exactObject(
        {
          remote: nonEmptyString,
          local: nonEmptyString,
        },
        ['remote', 'local']
      ),
    },
    ['download']
  ),
]

const taskSteps: AnySchemaObject = {
  type: 'array',
  items: { $ref: '#/definitions/taskStep' },
  minItems: 1,
}

export const deployJsonSchema: AnySchemaObject = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://catapultjs.com/schema/deploy.schema.json',
  title: 'Catapult deploy JSON configuration',
  description: 'Declarative deployment configuration for @catapultjs/deploy.',
  type: 'object',
  required: ['version', 'config'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    version: { const: 1 },
    recipes: {
      type: 'array',
      items: { enum: [...BUILT_IN_RECIPE_NAMES] },
      uniqueItems: true,
    },
    config: { $ref: '#/definitions/config' },
    store: { $ref: '#/definitions/store' },
    tasks: {
      type: 'object',
      propertyNames: taskName,
      additionalProperties: { $ref: '#/definitions/taskDefinition' },
    },
    pipeline: {
      type: 'array',
      items: taskName,
      minItems: 1,
      uniqueItems: true,
    },
    before: taskPlacements,
    after: taskPlacements,
    remove: {
      type: 'array',
      items: taskName,
      uniqueItems: true,
    },
  },
  definitions: {
    store: exactObject(
      {
        shared_dirs: stringArray,
        shared_files: stringArray,
        writable_dirs: stringArray,
        source_path: stringValue,
        adonisjs_path: stringValue,
        astro_mode: {
          oneOf: [
            nonEmptyString,
            {
              type: 'object',
              minProperties: 1,
              propertyNames: nonEmptyString,
              additionalProperties: nonEmptyString,
            },
          ],
        },
        astro_path: stringValue,
        caddy_config_path: nonEmptyString,
        caddy_local_config_path: nonEmptyString,
        caddy_use_sudo: { type: 'boolean' },
        caddy_validate_before_reload: { type: 'boolean' },
        caddy_reload_after_publish: { type: 'boolean' },
        directus_path: stringValue,
        directus_snapshot_path: nonEmptyString,
        nextjs_path: stringValue,
        nextjs_out_path: nonEmptyString,
        nuxt_path: stringValue,
        redis_db: {
          oneOf: [
            { type: 'integer', minimum: 0 },
            {
              type: 'array',
              items: { type: 'integer', minimum: 0 },
              minItems: 1,
              uniqueItems: true,
            },
          ],
        },
        rsync_source_path: nonEmptyString,
        rsync_excludes: stringArray,
        systemd_service: nonEmptyString,
        systemd_use_sudo: { type: 'boolean' },
        systemd_logs_lines: { type: 'number', exclusiveMinimum: 0 },
        vitepress_path: stringValue,
      },
      []
    ),
    config: exactObject(
      {
        keepReleases: { type: 'integer', minimum: 1 },
        repository: nonEmptyString,
        packageManager: { enum: ['npm', 'pnpm', 'yarn', 'bun'] },
        hosts: {
          type: 'array',
          items: { $ref: '#/definitions/host' },
          minItems: 1,
        },
        verbose: { enum: [0, 1, 2, 3] },
      },
      ['hosts']
    ),
    host: exactObject(
      {
        name: nonEmptyString,
        ssh: {
          oneOf: [
            nonEmptyString,
            exactObject(
              {
                user: nonEmptyString,
                host: nonEmptyString,
                port: { type: 'integer', minimum: 1, maximum: 65535 },
              },
              ['user', 'host']
            ),
          ],
        },
        deployPath: { type: 'string', minLength: 1, pattern: '^/' },
        branch: {
          oneOf: [
            nonEmptyString,
            exactObject(
              {
                name: nonEmptyString,
                ask: { type: 'boolean' },
              },
              ['name', 'ask']
            ),
          ],
        },
        healthcheck: exactObject(
          {
            url: nonEmptyString,
            retries: { type: 'integer', minimum: 1 },
            delayMs: { type: 'integer', minimum: 0 },
          },
          []
        ),
        bin: {
          type: 'object',
          propertyNames: nonEmptyString,
          additionalProperties: nonEmptyString,
        },
      },
      ['name', 'ssh', 'deployPath']
    ),
    taskStep: { oneOf: taskStepSchemas },
    taskDefinition: {
      oneOf: [
        taskSteps,
        exactObject(
          {
            description: nonEmptyString,
            steps: taskSteps,
          },
          ['steps']
        ),
      ],
    },
  },
}
