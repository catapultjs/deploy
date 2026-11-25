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

const composeName: AnySchemaObject = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.-]*$' }
const composeNames: AnySchemaObject = { type: 'array', uniqueItems: true, items: composeName }
const containerEngine: AnySchemaObject = { enum: ['docker', 'podman'] }
const commandArgs: AnySchemaObject = { type: 'array', minItems: 1, items: { type: 'string' } }
const envName: AnySchemaObject = { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]*$' }
const duration: AnySchemaObject = { type: 'string', pattern: '^(\\d+(ns|us|ms|s|m|h))+$' }
const containerService: AnySchemaObject = {
  type: 'object',
  properties: {
    command: commandArgs,
    init: { type: 'boolean' },
    healthcheck: {
      oneOf: [
        { type: 'boolean' },
        {
          type: 'object',
          properties: {
            cmd: nonEmptyString,
            interval: duration,
            timeout: duration,
            retries: { type: 'integer', minimum: 1 },
            start_period: duration,
          },
          required: ['cmd'],
          additionalProperties: false,
        },
      ],
    },
    entrypoint: nonEmptyString,
    user: nonEmptyString,
    env: {
      type: 'object',
      propertyNames: { pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
      additionalProperties: { type: 'string' },
    },
    env_file: { type: 'array', items: nonEmptyString },
    ports: { type: 'array', items: nonEmptyString },
    volumes: { type: 'array', items: nonEmptyString },
    restart: { type: 'string', pattern: '^(no|always|unless-stopped|on-failure(:\\d+)?)$' },
    labels: { type: 'object', additionalProperties: { type: 'string' } },
    memory: { type: 'string', pattern: '^\\d+(\\.\\d+)?[bkmgBKMG]?$' },
    cpus: {
      oneOf: [
        { type: 'number', exclusiveMinimum: 0 },
        { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      ],
    },
    networks: { type: 'array', uniqueItems: true, items: composeName },
    options: { type: 'array', items: nonEmptyString },
  },
  additionalProperties: false,
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
        caddy_upload_path: nonEmptyString,
        caddy_use_sudo: { type: 'boolean' },
        caddy_validate_before_reload: { type: 'boolean' },
        compose_files: { type: 'array', minItems: 1, uniqueItems: true, items: nonEmptyString },
        compose_image_services: composeNames,
        compose_logs_lines: { type: 'number', exclusiveMinimum: 0 },
        compose_migrate: exactObject(
          {
            service: composeName,
            command: { type: 'array', minItems: 1, items: { type: 'string' } },
          },
          ['service', 'command']
        ),
        compose_profiles: composeNames,
        compose_remove_orphans: { type: 'boolean' },
        compose_services: composeNames,
        compose_upload: { type: 'array', uniqueItems: true, items: nonEmptyString },
        compose_wait_timeout: { type: 'number', exclusiveMinimum: 0 },
        container_build: exactObject(
          {
            file: nonEmptyString,
            context: nonEmptyString,
            target: nonEmptyString,
            platform: nonEmptyString,
            args: {
              type: 'object',
              propertyNames: { pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
              additionalProperties: { type: 'string' },
            },
          },
          []
        ),
        container_build_engine: containerEngine,
        container_compression: { enum: ['none', 'gzip', 'zstd'] },
        container_engine: containerEngine,
        container_image: { type: 'string', pattern: '^[a-z0-9]+(?:[._-][a-z0-9]+)*$' },
        container_keep_local: { type: 'integer', minimum: 1 },
        container_logs_lines: { type: 'number', exclusiveMinimum: 0 },
        container_migrate: {
          type: 'object',
          properties: { service: composeName, command: commandArgs },
          required: ['service', 'command'],
          additionalProperties: false,
        },
        container_registry: exactObject(
          {
            repository: {
              type: 'string',
              pattern:
                '^[a-z0-9]+(?:[.-][a-z0-9]+)*(?::\\d+)?(?:/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)+$',
            },
            auth: exactObject({ username_env: envName, password_env: envName }, [
              'username_env',
              'password_env',
            ]),
          },
          ['repository']
        ),
        container_project: { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]*$' },
        container_services: {
          type: 'object',
          minProperties: 1,
          propertyNames: composeName,
          additionalProperties: containerService,
        },
        container_source: nonEmptyString,
        container_stop_timeout: { type: 'number', exclusiveMinimum: 0 },
        container_transfer: { enum: ['ssh', 'registry'] },
        container_wait_timeout: { type: 'number', exclusiveMinimum: 0 },
        directus_path: stringValue,
        directus_snapshot_path: nonEmptyString,
        nextjs_path: stringValue,
        nextjs_out_path: nonEmptyString,
        nextjs_server_path: nonEmptyString,
        nextjs_upload_archive: { type: 'boolean' },
        nuxt_path: stringValue,
        quadlet_logs_lines: { type: 'number', exclusiveMinimum: 0 },
        quadlet_path: nonEmptyString,
        quadlet_wait_timeout: { type: 'number', exclusiveMinimum: 0 },
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
        systemd_services: { type: 'array', minItems: 1, uniqueItems: true, items: nonEmptyString },
        systemd_unit_files: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', pattern: '\\.service$' },
        },
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
                identityFile: nonEmptyString,
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
        multiplexing: { type: 'boolean' },
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
