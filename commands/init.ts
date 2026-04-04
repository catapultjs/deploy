import { BaseCommand } from '@adonisjs/ace'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import { execa } from 'execa'
import { findDeployFile, detectPackageManager } from '../src/utils.ts'

const TEMPLATE = `import { defineConfig } from '@catapultjs/deploy'

await defineConfig({
  keepReleases: 5,

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

  async run() {
    const existing = await findDeployFile()
    if (existing) {
      this.logger.warning(`${existing} already exists`)
      return
    }

    const lang = await this.prompt.choice('Which language do you want to use?', [
      { name: 'ts', message: 'TypeScript (deploy.ts)' },
      { name: 'js', message: 'JavaScript (deploy.js)' },
    ])

    const filename = lang === 'ts' ? 'deploy.ts' : 'deploy.js'
    const dest = resolve(process.cwd(), filename)

    await writeFile(dest, TEMPLATE)
    this.logger.action(`create ${filename}`).succeeded()

    const pm = await detectPackageManager()
    this.logger.info('Installing @catapultjs/deploy...')
    await execa(pm, ['install', '-D', '@catapultjs/deploy'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    this.logger.action('install @catapultjs/deploy').succeeded()
  }
}
