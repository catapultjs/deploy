export interface BranchWithPrompt {
  name: string
  ask: boolean
}

export interface Host {
  name: string
  ssh: string
  deployPath: string
  branch?: string | BranchWithPrompt
  healthcheckUrl?: string
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

export type HookContext = { host?: Host; hosts?: Host[] }
export type HookFn = (context: HookContext) => Promise<void>

export interface Hooks {
  beforeDeploy?: HookFn
  afterDeploy?: HookFn
  beforeHostDeploy?: HookFn
  afterHostDeploy?: HookFn
}

export interface Config {
  keepReleases: number
  repository?: string

  healthcheckRetries?: number
  healthcheckDelayMs?: number
  hosts: Host[]

  hooks?: Hooks
  verbose?: boolean
}

export interface DeployContext {
  config: Config
  release: string
  hooks: Hooks
}
