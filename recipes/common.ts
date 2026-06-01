import { initPipeline } from '../index.ts'

import './deploy/lock.ts'
import './deploy/release.ts'
import './deploy/update_code.ts'
import './deploy/shared.ts'
import './deploy/publish.ts'
import './deploy/log_revision.ts'
import './deploy/healthcheck.ts'
import './deploy/cleanup.ts'
import './deploy/install.ts'
import './deploy/build.ts'
import './deploy/test.ts'

initPipeline([
  'deploy:lock',
  'deploy:release',
  'deploy:update_code',
  'deploy:shared',
  'deploy:publish',
  'deploy:log_revision',
  'deploy:healthcheck',
  'deploy:unlock',
  'deploy:cleanup',
])
