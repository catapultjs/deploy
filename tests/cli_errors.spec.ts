import { test } from '@japa/runner'
import { execa } from 'execa'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Kernel } from '@adonisjs/ace'
import { CatapultErrorHandler } from '../src/error_handler.ts'
import { Verbose } from '../src/enums.ts'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

function fakeKernel() {
  const errors: string[] = []
  const kernel = {
    ui: {
      colors: { bgRed: () => ({ white: (text: string) => text }) },
      logger: {
        error: (message: string) => errors.push(message),
        logError: (message: string) => errors.push(`ace: ${message}`),
        fatal: (error: Error) => errors.push(`fatal: ${error.message}`),
      },
    },
  } as unknown as Kernel<any>
  return { kernel, errors }
}

/** Records the stack printing instead of writing it. */
class SpyHandler extends CatapultErrorHandler {
  printed = false

  protected async prettyPrintError() {
    this.printed = true
  }
}

test.group('CLI errors', () => {
  test('reports an error with its message only', async ({ assert }) => {
    const { kernel, errors } = fakeKernel()
    const handler = new SpyHandler()
    await handler.render(new Error('[web] rollback refused'), kernel)
    assert.deepEqual(errors, ['[web] rollback refused'])
    assert.isFalse(handler.printed)
  })

  test('reports the stderr of a failed subprocess', async ({ assert }) => {
    const { kernel, errors } = fakeKernel()
    const error = Object.assign(new Error('Command failed with exit code 1: ssh ...'), {
      stderr: 'permission denied',
    })
    await new CatapultErrorHandler().render(error, kernel)
    assert.deepEqual(errors, ['permission denied'])
  })

  test('prints the stack at debug verbosity', async ({ assert }) => {
    const { kernel, errors } = fakeKernel()
    const handler = new SpyHandler(Verbose.DEBUG)
    await handler.render(new Error('boom'), kernel)
    assert.isTrue(handler.printed)
    assert.deepEqual(errors, [])
  })

  test('keeps the rendering of ace errors', async ({ assert }) => {
    const { kernel, errors } = fakeKernel()
    const error = Object.assign(new Error('Unknown flag "-v"'), { code: 'E_UNKNOWN_FLAG' })
    await new CatapultErrorHandler().render(error, kernel)
    assert.deepEqual(errors, ['ace:   ERROR   Unknown flag "-v"'])
  })

  test('deploy:setup reports a failing setup hook without stack', async ({ assert }) => {
    const cwd = await realpath(await mkdtemp(join(tmpdir(), 'cata-cli-errors-')))
    try {
      await writeFile(join(cwd, 'ssh'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      await writeFile(
        join(cwd, 'deploy.ts'),
        `import { defineConfig, onSetup } from '${join(projectRoot, 'index.ts')}'
onSetup(() => {
  throw new Error('[web] setup refused by a hook')
})
export default defineConfig({
  hosts: [{ name: 'web', ssh: 'deploy@web', deployPath: '/srv/app', multiplexing: false }],
})
`
      )
      const run = (env: Record<string, string> = {}) =>
        execa(process.execPath, [join(projectRoot, 'bin/run.ts'), 'deploy:setup'], {
          cwd,
          reject: false,
          all: true,
          env: { PATH: [cwd, process.env.PATH].join(delimiter), ...env },
        })

      const result = await run()
      assert.equal(result.exitCode, 1)
      assert.include(result.all, '[web] setup refused by a hook')
      assert.notInclude(result.all, 'deploy.ts:')
      assert.notInclude(result.all, 'at ')

      const debug = await run({ CATAPULT_DEBUG: '1' })
      assert.equal(debug.exitCode, 1)
      assert.include(debug.all, 'deploy.ts')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }).timeout(60_000)
})
