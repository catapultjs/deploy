import { set } from '../../index.ts'
import '../../recipes/deploy/release.ts'
import '../../recipes/deploy/publish.ts'
import '../../recipes/oci/index.ts'
import { rollbackHost } from '../../src/deployer.ts'
import { setPipeline } from '../../src/pipeline.ts'
import { runTask } from '../../src/task.ts'
import type { Host } from '../../src/types.ts'

interface Input {
  store?: Record<string, unknown>
  release: string
  hosts: { name: string; ssh: string; deployPath: string }[]
  tasks?: string[]
  rollback?: { host: string; target: string }
  verbose?: 0 | 1 | 2 | 3
}

const input: Input = JSON.parse(process.argv[2])
for (const [key, value] of Object.entries(input.store ?? {})) set(key, value)

const hosts: Host[] = input.hosts.map((host) => ({ ...host, multiplexing: false }))
const ctx = {
  release: input.release,
  hooks: {},
  config: { hosts, keepReleases: 5, verbose: input.verbose ?? 1 },
}

for (const host of hosts) {
  for (const name of input.tasks ?? []) await runTask(name, ctx, host)
}

if (input.rollback) {
  setPipeline([])
  const host = hosts.find((candidate) => candidate.name === input.rollback!.host)!
  await rollbackHost(ctx, host, input.rollback.target)
}
