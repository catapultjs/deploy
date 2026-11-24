/**
 * Container engine detection and host checks. Internal to the container recipes.
 */
import { execa } from 'execa'
import type { Host } from '../../src/types.ts'
import type { CatapultLogger } from '../../src/logger.ts'
import { q, ssh } from '../../src/utils.ts'
import { ENGINES, type Engine, configuredEngine, platformFromArch } from './config.ts'

export interface RemoteFacts {
  engine: Engine
  /** Binary to call on the host, honoring `host.bin`. */
  bin: string
  version: string
  platform: string
  rootless: boolean
  linger: 'yes' | 'no' | 'unknown'
  freeKb: number | null
}

const MIN_FREE_KB = 2 * 1024 * 1024
const facts = new Map<string, RemoteFacts>()

export function hostBin(host: Host, engine: Engine): string {
  return host.bin?.[engine] ?? engine
}

function parse(stdout: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const index = line.indexOf('=')
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1).trim()
  }
  return values
}

/**
 * Detects the engine on the host and gathers what the deployment depends on.
 * Throws when no usable engine is found; logs warnings for degraded setups.
 * Never installs or changes anything on the host.
 */
export async function checkHost(host: Host, logger: CatapultLogger): Promise<RemoteFacts> {
  const configured = configuredEngine()
  const candidates = (configured ? [configured] : ENGINES).map((engine) => ({
    engine,
    bin: hostBin(host, engine),
  }))
  const detect = candidates
    .map(
      ({ engine, bin }) =>
        `if [ -z "$engine" ] && command -v ${q(bin)} >/dev/null 2>&1; then engine=${engine}; bin=${q(bin)}; fi`
    )
    .join('\n')
  const infoFormat = {
    docker: '{{.DockerRootDir}}',
    podman: '{{.Store.GraphRoot}}',
  }

  const { stdout } = await ssh(
    host,
    `set +e
engine=''
bin=''
${detect}
echo "engine=$engine"
[ -n "$engine" ] || exit 0
echo "version=$("$bin" --version 2>/dev/null | head -n 1)"
if [ "$engine" = docker ]; then format=${q(infoFormat.docker)}; else format=${q(infoFormat.podman)}; fi
root=$("$bin" info --format "$format" 2>/dev/null)
status=$?
echo "info_status=$status"
if [ "$status" != 0 ]; then
  echo "info_error=$("$bin" info --format "$format" 2>&1 >/dev/null | tail -n 1)"
fi
echo "root=$root"
[ -n "$root" ] && echo "free_kb=$(df -Pk "$root" 2>/dev/null | awk 'NR==2 {print $4}')"
echo "arch=$(uname -m)"
echo "uid=$(id -u)"
if [ "$engine" = podman ] && [ "$(id -u)" != 0 ]; then
  if command -v loginctl >/dev/null 2>&1; then
    echo "linger=$(loginctl show-user "$(id -un)" --property=Linger --value 2>/dev/null)"
  fi
fi`
  )

  const values = parse(stdout)
  if (!values.engine) {
    const looked = candidates.map(({ bin }) => bin).join(', ')
    throw new Error(`[${host.name}] no container engine found (looked for ${looked})`)
  }
  if (values.info_status !== '0') {
    throw new Error(
      `[${host.name}] ${values.engine} is installed but not usable by this user: ${values.info_error || 'info failed'}`
    )
  }

  const engine = values.engine as Engine
  const rootless = values.uid !== '0'
  const freeKb = values.free_kb ? Number(values.free_kb) : null
  const linger = values.linger === 'yes' || values.linger === 'no' ? values.linger : 'unknown'
  const result: RemoteFacts = {
    engine,
    bin: hostBin(host, engine),
    version: values.version || engine,
    platform: platformFromArch(values.arch || ''),
    rootless,
    linger: engine === 'podman' && rootless ? linger : 'unknown',
    freeKb: freeKb !== null && Number.isFinite(freeKb) ? freeKb : null,
  }

  if (result.freeKb !== null && result.freeKb < MIN_FREE_KB) {
    logger.warning(
      `${Math.round(result.freeKb / 1024)} MB free in the ${engine} storage: an image transfer may fail`,
      { prefix: host.name }
    )
  }
  if (result.linger === 'no') {
    logger.warning(
      'linger is disabled: rootless containers stop when the SSH session ends. Run `sudo loginctl enable-linger <user>` on the server',
      { prefix: host.name }
    )
  }

  facts.set(host.name, result)
  return result
}

/** Facts gathered by `oci:check` for this host, checking it now if needed. */
export async function hostFacts(host: Host, logger: CatapultLogger): Promise<RemoteFacts> {
  return facts.get(host.name) ?? checkHost(host, logger)
}

async function localEngineAvailable(engine: Engine): Promise<boolean> {
  const result = await execa(engine, ['--version'], { reject: false })
  return result.exitCode === 0
}

const buildEngines = new Map<string, Promise<Engine>>()

/**
 * Engine used for local builds: `container_build_engine`, else the server engine
 * when installed locally, else the other one.
 */
export function localEngine(preferred: Engine, explicit?: Engine): Promise<Engine> {
  const key = `${explicit ?? ''}|${preferred}`
  let pending = buildEngines.get(key)
  if (!pending) {
    pending = (async () => {
      const candidates = explicit
        ? [explicit]
        : [preferred, ...ENGINES.filter((e) => e !== preferred)]
      for (const engine of candidates) {
        if (await localEngineAvailable(engine)) return engine
      }
      throw new Error(
        `no local container engine found to build the image (looked for ${candidates.join(', ')}). Set container_build_engine or install one`
      )
    })()
    buildEngines.set(key, pending)
  }
  return pending
}

/**
 * Podman has no daemon: containers with a restart policy come back after a reboot
 * only through podman-restart.service. Warns when it is not enabled.
 */
export async function checkPodmanRestart(
  host: Host,
  remote: RemoteFacts,
  logger: CatapultLogger
): Promise<void> {
  if (remote.engine !== 'podman') return
  const user = remote.rootless ? ' --user' : ''
  const { stdout } = await ssh(
    host,
    `set +e\ncommand -v systemctl >/dev/null 2>&1 || exit 0\nsystemctl${user} is-enabled podman-restart.service 2>/dev/null || true`
  )
  const value = stdout.trim()
  if (value && value !== 'enabled') {
    logger.warning(
      `podman-restart.service is not enabled: containers will not restart after a reboot. Run \`systemctl${user} enable podman-restart.service\` on the server`,
      { prefix: host.name }
    )
  }
}
