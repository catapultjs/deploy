import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { deployJsonSchema, type JsonDeployConfig } from '../src/config/json/schema.ts'
import { parseJsonConfig, validateJsonConfig } from '../src/config/json/loader.ts'

function validConfig(): JsonDeployConfig {
  return {
    version: 1,
    recipes: ['git'],
    config: {
      keepReleases: 2,
      verbose: 0,
      hosts: [
        {
          name: 'production',
          ssh: 'deploy@example.com',
          deployPath: '/home/deploy/app',
          branch: 'main',
        },
      ],
    },
    tasks: {
      'app:build': [{ cd: '{{release_path}}' }, { run: 'npm ci' }, { run: 'npm run build' }],
    },
    after: { 'deploy:shared': 'app:build' },
  }
}

test.group('JSON config — schema', () => {
  test('accepts a declarative deploy config', ({ assert }) => {
    const config = validateJsonConfig(validConfig())

    assert.equal(config.version, 1)
    assert.equal(config.config.hosts[0].name, 'production')
  })

  test('accepts all serializable task actions and host variants', ({ assert }) => {
    const config = validConfig()
    config.config.hosts[0].ssh = {
      user: 'deploy',
      host: 'example.com',
      port: 2222,
    }
    config.tasks!['app:build'] = {
      description: 'Builds the application',
      steps: [
        { local: { command: 'npm run build', cwd: './frontend' } },
        { upload: { local: './dist/.', remote: '{{release_path}}' } },
        { download: { remote: '{{current_path}}/.env', local: './.env.backup' } },
      ],
    }

    assert.doesNotThrow(() => validateJsonConfig(config))
  })

  test('accepts declarative pipeline replacement and mutations', ({ assert }) => {
    const config = validConfig()
    config.pipeline = ['deploy:shared', 'deploy:publish', 'deploy:cleanup']
    config.remove = ['deploy:cleanup']
    config.before = { 'deploy:publish': ['app:verify', 'app:check'] }
    config.after = { 'deploy:shared': ['app:install', 'app:build'] }

    assert.doesNotThrow(() => validateJsonConfig(config))
  })

  test('rejects the legacy pipeline operation shape', ({ assert }) => {
    const config = validConfig() as Record<string, any>
    config.pipeline = [{ op: 'set', tasks: ['app:build'] }]

    assert.throws(() => validateJsonConfig(config), /pipeline/)
  })

  test('rejects unsafe or malformed pipeline controls', ({ assert }) => {
    const emptyPipeline = validConfig()
    emptyPipeline.pipeline = []
    assert.throws(() => validateJsonConfig(emptyPipeline), /pipeline/)

    const duplicateRemoval = validConfig()
    duplicateRemoval.remove = ['deploy:cleanup', 'deploy:cleanup']
    assert.throws(() => validateJsonConfig(duplicateRemoval), /remove/)

    const emptyPlacement = validConfig() as Record<string, any>
    emptyPlacement.after = { 'deploy:shared': [] }
    assert.throws(() => validateJsonConfig(emptyPlacement), /after/)

    const invalidTaskName = validConfig()
    invalidTaskName.pipeline = ['task with spaces']
    assert.throws(() => validateJsonConfig(invalidTaskName), /pipeline/)
  })

  test('rejects unknown config properties', ({ assert }) => {
    const config = validConfig()
    Object.assign(config.config, { hooks: {} })

    assert.throws(() => validateJsonConfig(config), /hooks/)
  })

  test('rejects a task step with multiple actions', ({ assert }) => {
    const config = validConfig() as Record<string, any>
    config.tasks['app:build'] = [{ cd: '{{release_path}}', run: 'npm ci' }]

    assert.throws(() => validateJsonConfig(config), /Invalid JSON deploy config/)
  })

  test('rejects missing versions and unsupported recipes', ({ assert }) => {
    const withoutVersion = validConfig() as Record<string, any>
    delete withoutVersion.version
    assert.throws(() => validateJsonConfig(withoutVersion), /version/)

    const unsupportedRecipe = validConfig() as Record<string, any>
    unsupportedRecipe.recipes = ['local/custom-recipe']
    assert.throws(() => validateJsonConfig(unsupportedRecipe), /recipes/)
  })

  test('validates known recipe store values and rejects unknown keys', ({ assert }) => {
    const invalidValue = validConfig() as Record<string, any>
    invalidValue.store = { rsync_source_path: false }
    assert.throws(() => validateJsonConfig(invalidValue), /rsync_source_path/)

    const unknownKey = validConfig() as Record<string, any>
    unknownKey.store = { custom_recipe_setting: true }
    assert.throws(() => validateJsonConfig(unknownKey), /custom_recipe_setting/)
  })

  test('rejects duplicate host names', ({ assert }) => {
    const config = validConfig()
    config.config.hosts.push({ ...config.config.hosts[0] })

    assert.throws(() => validateJsonConfig(config), /duplicate host name "production"/)
  })

  test('reports strict JSON syntax errors with the source path', ({ assert }) => {
    assert.throws(
      () => parseJsonConfig("{ version: 1, 'config': {} }", '/tmp/deploy.config.json'),
      /Unable to parse JSON deploy config "\/tmp\/deploy\.config\.json"/
    )
  })

  test('keeps the published schema synchronized with runtime validation', async ({ assert }) => {
    const published = JSON.parse(
      await readFile(new URL('../schema/deploy.schema.json', import.meta.url), 'utf8')
    )

    assert.deepEqual(published, deployJsonSchema)
  })

  test('keeps the documentation schema synchronized with the published schema', async ({
    assert,
  }) => {
    const published = await readFile(
      new URL('../schema/deploy.schema.json', import.meta.url),
      'utf8'
    )
    const documentation = await readFile(
      new URL('../docs/public/schema/deploy.schema.json', import.meta.url),
      'utf8'
    )

    assert.equal(documentation, published)
  })
})
