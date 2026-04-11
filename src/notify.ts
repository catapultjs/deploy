import { $ } from 'execa'

export interface NotifyOptions {
  title?: string
  message: string
}

/** Sends a desktop notification. Supports macOS, Linux (notify-send) and Windows. */
export async function notify(options: NotifyOptions): Promise<void> {
  const title = options.title ?? 'Catapult'
  const { message } = options

  try {
    if (process.platform === 'darwin') {
      await $`osascript -e ${'display notification ' + JSON.stringify(message) + ' with title ' + JSON.stringify(title)}`
    } else if (process.platform === 'linux') {
      await $`notify-send ${title} ${message}`
    } else if (process.platform === 'win32') {
      await $`powershell -Command ${`[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show(${JSON.stringify(message)}, ${JSON.stringify(title)})`}`
    }
  } catch {}
}
