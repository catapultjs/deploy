import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

register(pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../src/loader.js')).href)
