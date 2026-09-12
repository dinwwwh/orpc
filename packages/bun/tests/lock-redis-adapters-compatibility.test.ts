import type { Locker } from '@orpc/lock'
import { RedisLocker } from '@orpc/lock/redis'
import { promiseWithResolvers } from '@orpc/shared'
import { RedisClient } from 'bun'
import { afterAll, describe, expect, it } from 'bun:test'
import { createClient } from 'redis'
import { BunRedisLocker } from '../src'

const REDIS_URL = Bun.env.REDIS_URL

describe.concurrent('lock redis adapters compatibility', async () => {
  const lockers: Array<{ name: string, locker: Locker }> = []
  const prefix = `redis-adapters:${crypto.randomUUID()}`

  if (REDIS_URL) {
    const redis = createClient({ url: REDIS_URL })

    afterAll(() => {
      redis.close()
    })

    lockers.push({
      name: 'redis',
      locker: new RedisLocker(redis, {
        prefix,
        ttl: 10_000,
        retryInterval: 10,
      }),
    })

    const bunRedis = new RedisClient(REDIS_URL)

    afterAll(() => {
      bunRedis.close()
    })

    lockers.push({
      name: 'bun redis',
      locker: new BunRedisLocker(bunRedis, {
        prefix,
        ttl: 10_000,
        retryInterval: 10,
      }),
    })
  }

  describe.skipIf(lockers.length < 2)('cross-adapter compatibility', () => {
    for (const source of lockers) {
      for (const target of lockers) {
        if (source === target) {
          continue
        }

        it(`shares lock state: ${source.name} → ${target.name}`, async () => {
          const key = `shared:${crypto.randomUUID()}`
          const { promise: release, resolve } = promiseWithResolvers<void>()
          const order: string[] = []

          const holder = source.locker.lock(key, async ({ waited }) => {
            order.push(`source:${waited}`)
            await release
            order.push('source:done')
          })

          await Bun.sleep(50)

          await expect(
            target.locker.lock(key, () => 'never', { timeout: 0 }),
          ).rejects.toMatchObject({ name: 'LockTimeoutError', key })

          const waiter = target.locker.lock(key, ({ waited }) => {
            order.push(`target:${waited}`)
            return 'ok'
          })

          await Bun.sleep(50)
          expect(order).toEqual(['source:false'])

          resolve()
          await holder

          await expect(waiter).resolves.toBe('ok')
          expect(order).toEqual(['source:false', 'source:done', 'target:true'])
        })
      }
    }
  })
})
