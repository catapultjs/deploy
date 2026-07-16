import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findDeployFile } from '../utils.ts'

export function parseConfigFlag(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--config' || argv[i] === '-c') && argv[i + 1]) {
      return argv[i + 1]
    }
  }
  return null
}

export async function resolveDeployConfigFile(argv: string[], cwd = process.cwd()): Promise<string> {
  const configFlag = parseConfigFlag(argv)

  if (configFlag) {
    const resolved = resolve(cwd, configFlag)
    try {
      await access(resolved)
      return resolved
    } catch {
      throw new Error(`Config file not found: ${configFlag}`)
    }
  }

  const deployFile = await findDeployFile(cwd)
  if (!deployFile) {
    throw new Error(
      'No supported deploy config file found in current directory. Run `npx cata init` to create one.'
    )
  }

  return deployFile
}
