import { test } from '@japa/runner'
import { execa } from 'execa'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const inspector = join(projectRoot, 'tests/fixtures/inspect_config.ts')

async function inspectConfig(cwd: string, configPath: string) {
  const reportPath = join(cwd, 'inspection.json')
  const result = await execa(process.execPath, [inspector, configPath, reportPath], {
    cwd,
    reject: false,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    result,
    report: result.exitCode === 0 ? JSON.parse(await readFile(reportPath, 'utf8')) : null,
  }
}

test.group('config loader', () => {
  test('loads recipes, store values, custom tasks, and pipeline mutations', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          recipes: ['caddy'],
          config: {
            hosts: [
              {
                name: 'production',
                ssh: 'deploy@example.com',
                deployPath: '/home/deploy/app',
              },
            ],
          },
          store: { caddy_reload_after_publish: true },
          tasks: {
            'app:install': [{ run: 'npm ci' }],
            'app:build': {
              description: 'Builds the application',
              steps: [{ cd: '{{release_path}}' }, { run: 'npm run build' }],
            },
            'app:verify': [{ run: 'npm test' }],
          },
          after: { 'deploy:shared': ['app:install', 'app:build'] },
          before: { 'deploy:publish': 'app:verify' },
          remove: ['deploy:log_revision'],
        })
      )

      const { result, report } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`)
      const { pipeline, tasks } = report
      assert.include(pipeline, 'caddy:reload')
      assert.notInclude(pipeline, 'deploy:log_revision')
      assert.notInclude(pipeline, 'deploy:healthcheck')
      const sharedIndex = pipeline.indexOf('deploy:shared')
      const publishIndex = pipeline.indexOf('deploy:publish')
      assert.deepEqual(pipeline.slice(sharedIndex + 1, sharedIndex + 3), [
        'app:install',
        'app:build',
      ])
      assert.equal(pipeline[publishIndex - 1], 'app:verify')
      assert.include(
        tasks.map((entry: { name: string }) => entry.name),
        'deploy:log_revision'
      )

      const customTask = tasks.find((entry: { name: string }) => entry.name === 'app:build')
      assert.deepEqual(customTask, {
        name: 'app:build',
        description: 'Builds the application',
      })
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('supports replacing the entire pipeline', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.json')
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          config: {
            hosts: [
              {
                name: 'production',
                ssh: 'deploy@example.com',
                deployPath: '/home/deploy/app',
              },
            ],
          },
          tasks: { 'app:only': [{ run: 'echo ok' }] },
          pipeline: ['app:only'],
        })
      )

      const { result, report } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`)
      assert.deepEqual(report.pipeline, ['app:only'])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('fails before command execution for an unregistered pipeline task', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          config: {
            hosts: [
              {
                name: 'production',
                ssh: 'deploy@example.com',
                deployPath: '/home/deploy/app',
              },
            ],
          },
          after: { 'deploy:shared': 'app:missing' },
        })
      )

      const { result } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 1)
      assert.include(`${result.stdout}\n${result.stderr}`, '/after/deploy:shared')
      assert.include(`${result.stdout}\n${result.stderr}`, 'task "app:missing"')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('applies pipeline, remove, before, and after in a fixed order', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          after: { 'app:start': ['app:after-one', 'app:after-two'] },
          remove: ['app:remove'],
          before: { 'app:end': ['app:before-one', 'app:before-two'] },
          pipeline: ['app:start', 'app:remove', 'app:end'],
          config: {
            hosts: [
              {
                name: 'production',
                ssh: 'deploy@example.com',
                deployPath: '/home/deploy/app',
              },
            ],
          },
          tasks: Object.fromEntries(
            [
              'app:start',
              'app:remove',
              'app:end',
              'app:after-one',
              'app:after-two',
              'app:before-one',
              'app:before-two',
            ].map((name) => [name, [{ run: `echo ${name}` }]])
          ),
        })
      )

      const { result, report } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`)
      assert.deepEqual(report.pipeline, [
        'app:start',
        'app:after-one',
        'app:after-two',
        'app:before-one',
        'app:before-two',
        'app:end',
      ])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('reports missing pipeline mutation targets with JSON paths', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      const baseConfig = {
        version: 1,
        config: {
          hosts: [
            {
              name: 'production',
              ssh: 'deploy@example.com',
              deployPath: '/home/deploy/app',
            },
          ],
        },
        tasks: { 'app:known': [{ run: 'echo ok' }] },
      }
      const cases = [
        {
          controls: { before: { 'app:missing-before': 'app:known' } },
          path: '/before/app:missing-before',
        },
        {
          controls: { after: { 'app:missing-after': 'app:known' } },
          path: '/after/app:missing-after',
        },
        {
          controls: { remove: ['app:missing-remove'] },
          path: '/remove/0',
        },
      ]

      for (const { controls, path } of cases) {
        await writeFile(configPath, JSON.stringify({ ...baseConfig, ...controls }))
        const { result } = await inspectConfig(cwd, configPath)
        assert.equal(result.exitCode, 1)
        assert.include(`${result.stdout}\n${result.stderr}`, path)
        assert.include(`${result.stdout}\n${result.stderr}`, 'not found in pipeline')
      }
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('rejects pipeline controls that remove every task', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          config: {
            hosts: [
              {
                name: 'production',
                ssh: 'deploy@example.com',
                deployPath: '/home/deploy/app',
              },
            ],
          },
          tasks: { 'app:only': [{ run: 'echo ok' }] },
          pipeline: ['app:only'],
          remove: ['app:only'],
        })
      )

      const { result } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 1)
      assert.include(`${result.stdout}\n${result.stderr}`, '/pipeline')
      assert.include(`${result.stdout}\n${result.stderr}`, 'must contain at least one task')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('rejects ambiguous pipeline placements', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      const baseConfig = {
        version: 1,
        config: {
          hosts: [
            {
              name: 'production',
              ssh: 'deploy@example.com',
              deployPath: '/home/deploy/app',
            },
          ],
        },
        tasks: {
          'app:first': [{ run: 'echo first' }],
          'app:second': [{ run: 'echo second' }],
        },
      }
      const cases = [
        {
          controls: {
            before: { 'deploy:publish': 'app:first' },
            after: { 'deploy:shared': 'app:first' },
          },
          message: 'is already placed',
        },
        {
          controls: {
            after: { 'deploy:shared': 'app:first', 'app:first': 'app:second' },
          },
          message: 'cannot also be a before/after target',
        },
        {
          controls: {
            pipeline: ['app:first', 'deploy:publish'],
            remove: ['app:first'],
            before: { 'deploy:publish': 'app:first' },
          },
          message: 'cannot be both placed and removed',
        },
      ]

      for (const { controls, message } of cases) {
        await writeFile(configPath, JSON.stringify({ ...baseConfig, ...controls }))
        const { result } = await inspectConfig(cwd, configPath)
        assert.equal(result.exitCode, 1)
        assert.include(`${result.stdout}\n${result.stderr}`, message)
      }
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('rejects a pipeline emptied during config initialization', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-json-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          config: {
            hosts: [
              {
                name: 'production',
                ssh: 'deploy@example.com',
                deployPath: '/home/deploy/app',
              },
            ],
          },
          pipeline: ['deploy:healthcheck'],
        })
      )

      const { result } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 1)
      assert.include(`${result.stdout}\n${result.stderr}`, '/pipeline')
      assert.include(`${result.stdout}\n${result.stderr}`, 'must contain at least one task')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('keeps JavaScript and TypeScript module configs working', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-module-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.ts')
      const entrypoint = pathToFileURL(join(projectRoot, 'index.ts')).href
      await writeFile(
        configPath,
        `import { defineConfig } from ${JSON.stringify(entrypoint)}\n` +
          `export default defineConfig({ hosts: [{ name: 'production', ssh: 'deploy@example.com', deployPath: '/home/deploy/app' }] })\n`
      )

      const { result, report } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`)
      assert.include(report.pipeline, 'deploy:release')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('supports store-dependent recipes from TypeScript configs', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-module-loader-'))

    try {
      const configPath = join(cwd, 'deploy.config.ts')
      const entrypoint = pathToFileURL(join(projectRoot, 'index.ts')).href
      const caddyRecipe = pathToFileURL(join(projectRoot, 'recipes/caddy.ts')).href
      await writeFile(
        configPath,
        `import { defineConfig, set } from ${JSON.stringify(entrypoint)}\n` +
          `set('caddy_reload_after_publish', true)\n` +
          `await import(${JSON.stringify(caddyRecipe)})\n` +
          `export default defineConfig({ hosts: [{ name: 'production', ssh: 'deploy@example.com', deployPath: '/home/deploy/app' }] })\n`
      )

      const { result, report } = await inspectConfig(cwd, configPath)
      assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`)
      const publishIndex = report.pipeline.indexOf('deploy:publish')
      assert.equal(report.pipeline[publishIndex + 1], 'caddy:reload')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
