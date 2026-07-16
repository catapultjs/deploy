import { test } from '@japa/runner'
import { execa } from 'execa'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const cata = join(projectRoot, 'bin/run.ts')

async function runCata(cwd: string, args: string[], outputPath: string) {
  return execa(
    'sh',
    ['-c', `"${process.execPath}" "${cata}" ${args.join(' ')} > "${outputPath}" 2>&1`],
    {
      cwd,
      reject: false,
      stderr: 'pipe',
    }
  )
}

function validJsonConfig() {
  return {
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
  }
}

test.group('config:validate command', () => {
  test('shows help without requiring a deploy config', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-config-validate-'))

    try {
      const outputPath = join(cwd, 'help.txt')
      const result = await runCata(cwd, ['config:validate', '--help'], outputPath)
      const output = await readFile(outputPath, 'utf8')

      assert.equal(result.exitCode, 0, output)
      assert.include(output, 'Validate the deploy configuration file')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('validates the detected deploy config', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-config-validate-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      const outputPath = join(cwd, 'validation.txt')
      await writeFile(configPath, JSON.stringify(validJsonConfig()))

      const result = await runCata(cwd, ['config:validate'], outputPath)
      const output = await readFile(outputPath, 'utf8')

      assert.equal(result.exitCode, 0, result.stderr)
      assert.include(output, 'valid')
      assert.include(output, configPath)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('outputs JSON on success', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-config-validate-'))

    try {
      const configPath = join(cwd, 'deploy.json')
      const outputPath = join(cwd, 'validation.json')
      await writeFile(configPath, JSON.stringify(validJsonConfig()))

      const result = await runCata(cwd, ['config:validate', '--json'], outputPath)
      const output = await readFile(outputPath, 'utf8')

      assert.equal(result.exitCode, 0, result.stderr)
      assert.deepEqual(JSON.parse(output), { valid: true, file: configPath })
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('outputs JSON on validation failure', async ({ assert }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'cata-config-validate-'))

    try {
      const configPath = join(cwd, 'deploy.config.json')
      const outputPath = join(cwd, 'validation.json')
      await writeFile(configPath, JSON.stringify({ version: 1, config: { hosts: [] } }))

      const result = await runCata(cwd, ['config:validate', '--json'], outputPath)
      const output = await readFile(outputPath, 'utf8')

      assert.equal(result.exitCode, 1)
      const report = JSON.parse(output)
      assert.equal(report.valid, false)
      assert.equal(report.file, configPath)
      assert.include(report.error, '/config/hosts')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
