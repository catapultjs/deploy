export interface BranchWithPrompt {
  name: string
  ask: boolean
}

export interface SshConfig {
  user: string
  host: string
  port?: number
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
}

export interface Paths {
  base: string
  current: string
  releases: string
  release: string
  shared: string
  lock: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TaskRegistry {}

export type TaskName = keyof TaskRegistry | (string & {})

export type HookContext = { host?: Host; hosts?: Host[]; error?: Error }
export type HookFn = (context: HookContext) => Promise<void>

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

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
  verbose?: 0 | 1 | 2
}

export interface DeployContext {
  config: Config
  release: string
  hooks: Hooks
}
