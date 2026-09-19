import { cp, mkdir, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const IGNORED_DIRECTORIES = new Set(['.vitepress', 'node_modules'])
const IGNORED_FILES = new Set(['AGENTS.md', 'README.md', 'TODO.md'])

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : markdownFiles(path)
      }

      return entry.isFile() && path.endsWith('.md') && !IGNORED_FILES.has(entry.name) ? [path] : []
    })
  )

  return files.flat()
}

/**
 * Publish a Markdown twin next to every public VitePress page. Caddy serves
 * these files only to clients that explicitly negotiate `text/markdown`.
 */
export async function buildAgentMarkdown(srcDir: string, outDir: string): Promise<void> {
  const files = await markdownFiles(srcDir)

  await Promise.all(
    files.map(async (file) => {
      const output = join(outDir, relative(srcDir, file))
      await mkdir(join(output, '..'), { recursive: true })
      await cp(file, output)
    })
  )
}
