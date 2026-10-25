import { test } from '@japa/runner'
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

async function transfer(failure = '') {
  const directory = await mkdtemp(join(tmpdir(), 'cata-archive-'))
  try {
    const output = join(directory, 'standalone output')
    const extracted = join(directory, 'extracted')
    await mkdir(output)
    await mkdir(extracted)
    await writeFile(join(output, '.hidden'), 'hidden asset')
    await writeFile(join(output, 'extra.txt'), 'post-build artifact')
    await symlink('extra.txt', join(output, 'link'))
    for (const name of ['scp', 'ssh']) {
      await writeFile(
        join(directory, name),
        `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const args = process.argv.slice(2)
if (path.basename(process.argv[1]) === 'scp') {
  fs.writeFileSync(process.env.ARCHIVE_TEST_DIR + '/upload.json', JSON.stringify(args))
  if (process.env.ARCHIVE_TEST_FAIL === 'upload') process.exit(1)
  fs.copyFileSync(args.at(-2), process.env.ARCHIVE_TEST_DIR + '/received.tar.gz')
} else {
  const command = Buffer.from(args.at(-1).match(/echo ([A-Za-z0-9+/=]+)\\|/)[1], 'base64').toString()
  fs.appendFileSync(process.env.ARCHIVE_TEST_DIR + '/commands.jsonl', JSON.stringify(command) + '\\n')
  if (command.includes('tar -xzf')) {
    if (process.env.ARCHIVE_TEST_FAIL === 'extract') process.exit(1)
    const result = cp.spawnSync('tar', ['-xzf', process.env.ARCHIVE_TEST_DIR + '/received.tar.gz', '-C', process.env.ARCHIVE_TEST_DIR + '/extracted'])
    process.exit(result.status)
  }
}
`,
        { mode: 0o755 }
      )
    }
    const result = await execa(
      process.execPath,
      [
        fileURLToPath(new URL('./fixtures/run_nextjs_local.ts', import.meta.url)),
        JSON.stringify({
          uploadOnly: true,
          store: { nextjs_out_path: output, nextjs_upload_archive: true },
        }),
      ],
      {
        reject: false,
        env: {
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          ARCHIVE_TEST_DIR: directory,
          ARCHIVE_TEST_FAIL: failure,
        },
      }
    )
    const upload = JSON.parse(await readFile(join(directory, 'upload.json'), 'utf8'))
    const commandLog = await readFile(join(directory, 'commands.jsonl'), 'utf8')
    const commands = commandLog
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    let localArchiveExists = true
    try {
      await access(upload.at(-2))
    } catch {
      localArchiveExists = false
    }
    return {
      result,
      upload,
      commands,
      localArchiveExists,
      hidden: failure ? undefined : await readFile(join(extracted, '.hidden'), 'utf8'),
      linked: failure ? undefined : await readFile(join(extracted, 'link'), 'utf8'),
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test.group('Next.js archive transfer', () => {
  test('transfers one real archive including hidden files and symlink targets', async ({
    assert,
  }) => {
    const value = await transfer()
    assert.equal(value.result.exitCode, 0, value.result.stderr)
    assert.match(value.upload[1], /release\.tar\.gz$/)
    assert.equal(value.hidden, 'hidden asset')
    assert.equal(value.linked, 'post-build artifact')
    assert.include(
      value.commands[1],
      "tar -xzf '/srv/app/.catapult/nextjs-test.tar.gz' -C '/srv/app/releases/test'"
    )
    assert.include(value.commands[2], "rm -f '/srv/app/.catapult/nextjs-test.tar.gz'")
    assert.isFalse(value.localArchiveExists)
  })
  for (const failure of ['upload', 'extract']) {
    test(`fails on ${failure} errors and cleans up both archives`, async ({ assert }) => {
      const value = await transfer(failure)
      assert.notEqual(value.result.exitCode, 0)
      assert.include(value.commands.at(-1), "rm -f '/srv/app/.catapult/nextjs-test.tar.gz'")
      assert.isFalse(value.localArchiveExists)
      if (failure === 'upload') assert.notInclude(JSON.stringify(value.commands), 'tar -xzf')
    })
  }
})
