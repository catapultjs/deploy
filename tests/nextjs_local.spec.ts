import { test } from '@japa/runner'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

async function build(
  options: {
    nested?: boolean
    public?: boolean
    missing?: boolean
    fail?: boolean
    customOutput?: boolean
  } = {}
) {
  const directory = await mkdtemp(join(tmpdir(), 'cata-next-local-'))
  const cwd = join(directory, 'app with spaces')
  const output = join(cwd, options.customOutput ? 'artifact' : '.next/standalone')
  const serverPath = options.nested ? 'apps/web/server.js' : 'server.js'
  try {
    await mkdir(join(directory, 'bin'))
    await mkdir(join(cwd, '.next/static'), { recursive: true })
    await mkdir(join(output, 'node_modules/example'), { recursive: true })
    await writeFile(join(output, 'node_modules/example/index.js'), 'runtime dependency')
    await mkdir(join(output, options.nested ? 'apps/web' : ''), { recursive: true })
    if (!options.missing) await writeFile(join(output, serverPath), 'standalone server')
    await writeFile(join(cwd, '.next/static/chunk.js'), 'static asset')
    if (options.public !== false) {
      await mkdir(join(cwd, 'public'))
      await writeFile(join(cwd, 'public/favicon.ico'), 'favicon')
    }
    await writeFile(
      join(directory, 'bin/npm'),
      `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(join(directory, 'build.json'))}, JSON.stringify({cwd: process.cwd(), args: process.argv.slice(2)})); process.exit(${options.fail ? 1 : 0})`,
      { mode: 0o755 }
    )
    await writeFile(
      join(directory, 'bin/scp'),
      `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(join(directory, 'upload.json'))}, JSON.stringify(process.argv.slice(2)))`,
      { mode: 0o755 }
    )
    const result = await execa(
      process.execPath,
      [
        fileURLToPath(new URL('./fixtures/run_nextjs_local.ts', import.meta.url)),
        JSON.stringify({
          store: {
            nextjs_path: cwd,
            nextjs_server_path: serverPath,
            ...(options.customOutput ? { nextjs_out_path: 'artifact' } : {}),
          },
        }),
      ],
      { reject: false, env: { PATH: `${join(directory, 'bin')}${delimiter}${process.env.PATH}` } }
    )
    const invocation = JSON.parse(await readFile(join(directory, 'build.json'), 'utf8'))
    if (options.missing || options.fail) {
      let uploaded = false
      try {
        await readFile(join(directory, 'upload.json'))
        uploaded = true
      } catch {}
      return { result, invocation, uploaded }
    }
    const runtime = join(output, options.nested ? 'apps/web' : '')
    return {
      result,
      invocation,
      cwd,
      output,
      upload: JSON.parse(await readFile(join(directory, 'upload.json'), 'utf8')),
      static: await readFile(join(runtime, '.next/static/chunk.js'), 'utf8'),
      public:
        options.public === false
          ? undefined
          : await readFile(join(runtime, 'public/favicon.ico'), 'utf8'),
      dependency: await readFile(join(output, 'node_modules/example/index.js'), 'utf8'),
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test.group('Next.js local recipe', () => {
  test('packages assets and traced dependencies and uploads standalone contents', async ({
    assert,
  }) => {
    const value = await build()
    assert.equal(value.result.exitCode, 0, value.result.stderr)
    assert.deepEqual(value.invocation, { cwd: value.cwd, args: ['exec', '--', 'next', 'build'] })
    assert.equal(value.static, 'static asset')
    assert.equal(value.public, 'favicon')
    assert.equal(value.dependency, 'runtime dependency')
    assert.deepEqual(value.upload, [
      '-r',
      `${value.output}/.`,
      'deploy@example.test:/srv/app/releases/test',
    ])
    assert.include(value.result.stdout, 'deploy:build","deploy:lock')
    assert.notInclude(value.result.stdout, 'deploy:install')
  })
  test('supports nested monorepo servers and a custom output directory', async ({ assert }) => {
    const value = await build({ nested: true, customOutput: true })
    assert.equal(value.result.exitCode, 0, value.result.stderr)
    assert.equal(value.static, 'static asset')
    assert.equal(value.public, 'favicon')
  })
  test('allows an application without public assets', async ({ assert }) => {
    const value = await build({ public: false })
    assert.equal(value.result.exitCode, 0, value.result.stderr)
    assert.equal(value.static, 'static asset')
  })
  test('fails before upload when standalone output is missing', async ({ assert }) => {
    const value = await build({ missing: true })
    assert.notEqual(value.result.exitCode, 0)
    assert.include(value.result.stderr, "enable output: 'standalone'")
    assert.isFalse(value.uploaded)
  })
  test('fails before upload when the local build fails', async ({ assert }) => {
    const value = await build({ fail: true })
    assert.notEqual(value.result.exitCode, 0)
    assert.isFalse(value.uploaded)
  })
})
