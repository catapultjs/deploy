import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { deployJsonSchema } from '../src/config/json/schema.ts'

const schemaDirectory = new URL('../schema/', import.meta.url)
const schemaFile = new URL('deploy.schema.json', schemaDirectory)
const docsSchemaDirectory = new URL('../docs/public/schema/', import.meta.url)
const docsSchemaFile = new URL('deploy.schema.json', docsSchemaDirectory)

await mkdir(schemaDirectory, { recursive: true })
await mkdir(docsSchemaDirectory, { recursive: true })
const prettierConfig = await resolveConfig(fileURLToPath(schemaFile))
const contents = await format(JSON.stringify(deployJsonSchema), {
  ...prettierConfig,
  parser: 'json',
})
await writeFile(schemaFile, contents)
await writeFile(docsSchemaFile, contents)
