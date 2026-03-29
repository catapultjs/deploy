import { BaseCommand } from '@adonisjs/ace'
import { access, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { execa } from 'execa'

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
  static description = 'Create a deploy.ts configuration file'

  async run() {
    const dest = resolve(process.cwd(), 'deploy.ts')

    try {
      await access(dest)
      this.logger.warning('deploy.ts already exists')
      return
    } catch {}

    await writeFile(dest, TEMPLATE)
    this.logger.action('create deploy.ts').succeeded()

    this.logger.info('Installing @catapultjs/deploy...')
    await execa('npm', ['install', '-D', '@catapultjs/deploy'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    this.logger.action('install @catapultjs/deploy').succeeded()
  }
}
