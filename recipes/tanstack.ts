/**
 * TYPE: remote-build
 * DESCRIPTION:
 * This recipe builds and deploys a TanStack Start app directly on the remote server.
 */
import { set, after } from '../index.ts'

set('shared_files', ['.env'])

after('deploy:update_code', 'deploy:install')
after('deploy:install', 'deploy:build')
