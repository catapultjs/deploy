import type {} from '../src/types.ts'
import { task, desc, run, get, set, cd } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'directus:database:migrate': true
    'directus:snapshot:create': true
    'directus:snapshot:apply': true
  }
}

set('writable_dirs', ['uploads'])
set('shared_dirs', ['uploads'])
set('shared_files', ['.env'])
set('directus_path', get('source_path', ''))
set('directus_snapshot_path', './snapshot.yaml')

desc('Migrates the Directus database')
task('directus:database:migrate', () => {
  const directusPath = get<string>('directus_path')
  cd(`{{release_path}}/${directusPath}`)
  run(`directus database migrate:latest`)
})

desc('Creates a snapshot of the Directus schema')
task('directus:snapshot:create', () => {
  const directusPath = get<string>('directus_path')
  const snapshotPath = get<string>('directus_snapshot_path')
  cd(`{{release_path}}/${directusPath}`)
  run(`directus schema snapshot ${snapshotPath}`)
})

desc('Applies the Directus schema snapshot')
task('directus:snapshot:apply', () => {
  const directusPath = get<string>('directus_path')
  const snapshotPath = get<string>('directus_snapshot_path')
  cd(`{{release_path}}/${directusPath}`)
  run(`directus schema apply -y ${snapshotPath}`)
})
