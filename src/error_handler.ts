import { ExceptionHandler, type Kernel } from '@adonisjs/ace'
import { Verbose } from './enums.ts'
import { sshErrorMessage } from './utils.ts'

/**
 * Reports a failed command with its message only, as `cata deploy` does: errors raised
 * by tasks and hooks (a failed check, a refused rollback) are expected and their stack
 * is noise. The stack is printed with `-vvv` or `CATAPULT_DEBUG=1`. Ace errors (unknown
 * flag, cancelled prompt...) keep their default rendering.
 */
export class CatapultErrorHandler extends ExceptionHandler {
  readonly verbose: number

  constructor(verbose: number = Verbose.SILENT) {
    super()
    this.verbose = verbose
  }

  get showsStack(): boolean {
    return this.verbose >= Verbose.DEBUG || process.env.CATAPULT_DEBUG === '1'
  }

  async render(error: unknown, kernel: Kernel<any>) {
    const code = (error as { code?: unknown })?.code
    const aceError = typeof code === 'string' && code.startsWith('E_')
    if (this.showsStack || aceError || !(error instanceof Error)) {
      return super.render(error, kernel)
    }
    kernel.ui.logger.error(sshErrorMessage(error))
  }
}
