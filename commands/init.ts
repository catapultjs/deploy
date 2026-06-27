import { BaseCommand, flags } from '@adonisjs/ace'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execa } from 'execa'
import { findDeployFile, detectPackageManager } from '../src/utils.ts'

const TEMPLATE = `import { defineConfig } from '@catapultjs/deploy'

export default defineConfig({
  hosts: [
    {
      name: 'production',
      ssh: 'deploy@example.com',
      deployPath: '/home/deploy/myapp',
      branch: 'main',
    },
  ],
})
`

export default class Init extends BaseCommand {
  static commandName = 'init'
  static description = 'Create a deploy configuration file'

  @flags.boolean({ description: 'Create the config file without installing @catapultjs/deploy' })
  declare skipInstall: boolean

  async run() {
    const existing = await findDeployFile()
    if (existing) {
      this.logger.warning(`${existing} already exists`)
      return
    }

    const lang = await this.prompt.choice('Which language do you want to use?', [
      { name: 'ts', message: 'TypeScript (deploy.config.ts)' },
      { name: 'js', message: 'JavaScript (deploy.config.js)' },
    ])

    const filename = lang === 'ts' ? 'deploy.config.ts' : 'deploy.config.js'
    const dest = resolve(process.cwd(), filename)

    await writeFile(dest, TEMPLATE)
    this.logger.action(`create ${filename}`).succeeded()

    if (this.skipInstall) {
      this.logger.info('Skipping @catapultjs/deploy installation')
      return
    }

    const pm = await detectPackageManager()
    this.logger.info('Installing @catapultjs/deploy...')
    await execa(pm, ['install', '-D', '@catapultjs/deploy'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    this.logger.action('install @catapultjs/deploy').succeeded()
  }
}
