/**
 * TYPE: local-build
 * DESCRIPTION:
 * Builds Next.js locally and uploads a self-contained standalone server.
 */
import { access, cp, mkdir } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { type TaskContext, task, desc, get, set, local, upload, before, pmExec } from '../index.ts'

set('shared_files', get('shared_files', ['.env']))

function outputPath(): string {
  return resolve(get<string>('nextjs_path', ''), get<string>('nextjs_out_path', '.next/standalone'))
}

desc('Builds the Next.js standalone server locally')
task('deploy:build', async () => {
  const cwd = resolve(get<string>('nextjs_path', ''))
  await local(pmExec('next build'), { cwd })

  const output = outputPath()
  const server = resolve(output, get<string>('nextjs_server_path', 'server.js'))
  if (!server.startsWith(output + '/'))
    throw new Error('nextjs_server_path must stay inside the standalone output')
  try {
    await access(server)
  } catch {
    throw new Error(
      `Next.js standalone server missing at ${server}; enable output: 'standalone' and check nextjs_out_path / nextjs_server_path`
    )
  }
  try {
    await access(join(cwd, 'ecosystem.config.cjs'))
    await cp(join(cwd, 'ecosystem.config.cjs'), join(output, 'ecosystem.config.cjs'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const runtime = dirname(server)
  await mkdir(join(runtime, '.next'), { recursive: true })
  await cp(join(cwd, '.next/static'), join(runtime, '.next/static'), { recursive: true })
  try {
    await access(join(cwd, 'public'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return
  }
  await cp(join(cwd, 'public'), join(runtime, 'public'), { recursive: true })
})

desc('Uploads the local Next.js standalone output')
task('deploy:update_code', async ({ paths }: TaskContext) => {
  await upload(`${outputPath()}/.`, paths.release)
})

before('deploy:lock', 'deploy:build')
