/**
 * Cleanup of engine and Compose output for logs and error messages. Internal to the
 * container recipes.
 */

const ANSI_CODES = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
/** Compose progress lines, e.g. `Container app-web-run-1a2b Created`. */
const PROGRESS_LINE = /^(Container|Network|Volume|Image) \S+ \S+$/
const FAILURE_LINES = 20

/** Removes ANSI codes and the banner `podman compose` prints before running a provider. */
export function cleanOutput(output: string): string {
  return output
    .replaceAll(ANSI_CODES, '')
    .split('\n')
    .filter((line) => !line.includes('>>>>'))
    .join('\n')
    .trim()
}

/**
 * Last lines a failed command printed, stdout then stderr, without Compose progress
 * lines: one-off commands such as migrations often report their error on stdout.
 */
export function failureOutput(error: unknown): string {
  const { stdout, stderr } = error as { stdout?: unknown; stderr?: unknown }
  return [stdout, stderr]
    .map((stream) => cleanOutput(typeof stream === 'string' ? stream : ''))
    .join('\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !PROGRESS_LINE.test(line.trim()))
    .slice(-FAILURE_LINES)
    .join('\n')
}

/** Exit code of a failed subprocess, when known. */
export function exitCodeOf(error: unknown): number | undefined {
  const code = (error as { exitCode?: unknown })?.exitCode
  return typeof code === 'number' ? code : undefined
}
