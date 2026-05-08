import type {} from '../src/types.ts'
import { task, desc, run, get, set } from '../index.ts'

declare module '../src/types.ts' {
  interface TaskRegistry {
    'redis:db:flush': true
    'redis:db:flush_all': true
  }
}

set('redis_db', 1)

desc('Flushes the configured Redis database')
task('redis:db:flush', () => {
  const redisDbs = get<number | number[]>('redis_db', 1)

  for (const redisDb of Array.isArray(redisDbs) ? redisDbs : [redisDbs]) {
    run(`redis-cli -n ${redisDb} FLUSHDB`)
  }
})

desc('Flushes all Redis databases')
task('redis:db:flush_all', () => {
  run('redis-cli FLUSHALL')
})
