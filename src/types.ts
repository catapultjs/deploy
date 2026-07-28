import type { PackageManager, Verbose } from './enums.ts'

export interface BranchWithPrompt {
  name: string
  ask: boolean
}

export interface SshConfig {
  user: string
  host: string
  port?: number
  /** Path to the private key file (ssh -i). Tilde (~) is expanded by ssh. */
  identityFile?: string
}

export interface Healthcheck {
  url?: string
  retries?: number
  delayMs?: number
}

export interface Host {
  name: string
  ssh: string | SshConfig
  deployPath: string
  branch?: string | BranchWithPrompt
  healthcheck?: Healthcheck
  bin?: Record<string, string>
  /**
   * SSH connection multiplexing (ControlMaster/ControlPath).
   * Defaults to enabled on Unix and disabled on Windows (native OpenSSH has no
   * control-socket support). Set explicitly to override the auto-detection.
   */
  multiplexing?: boolean
}

export interface Paths {
  base: string
  current: string
  releases: string
  release: string
  shared: string
  cataConfig: string
  repo: string
  lock: string
}

export interface TaskRegistry {}

export type TaskName = keyof TaskRegistry | (string & {})

export type HookContext = { host?: Host; hosts?: Host[]; error?: Error }
export type HookFn = (context: HookContext) => Promise<void>

export interface Hooks {
  beforeDeploy?: HookFn
  afterDeploy?: HookFn
  afterFailure?: HookFn
  beforeHostDeploy?: HookFn
  afterHostDeploy?: HookFn
}

export interface Config {
  keepReleases?: number
  repository?: string

  packageManager?: PackageManager
  hosts: Host[]

  hooks?: Hooks
  verbose?: Verbose
}

export interface DeployContext {
  config: Config
  release: string
  hooks: Hooks
}
