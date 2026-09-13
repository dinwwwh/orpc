import { promiseWithResolvers, sleep } from '@orpc/shared'
import { Redis } from '@upstash/redis'
import { LockTimeoutError } from '../error'
import { UpstashLocker } from './upstash'

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

/**
 * These tests depend on a real Upstash redis server — make sure to set the
 * `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` envs.
 * When writing new tests, always use unique keys to avoid conflicts with other
 * test cases.
 */
describe.concurrent(
  'upstash locker integration',
  { skip: !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN, timeout: 20_000 },
  () => {
    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })

    function createTestingLocker(
      options: Partial<ConstructorParameters<typeof UpstashLocker>[1]> = {},
    ) {
      const prefix = `orpc-upstash-locker-${crypto.randomUUID()}:`

      return {
        prefix,
        locker: new UpstashLocker(redis, {
          prefix,
          ttl: 10_000,
          retryInterval: 50,
          ...options,
        }),
      }
    }

    it('runs the callback immediately when the lock is free and releases afterwards', async () => {
      const { prefix, locker } = createTestingLocker()
      const fn = vi.fn(async () => {
        expect(await redis.exists(`${prefix}key`)).toBe(1)
        return 'ok'
      })

      await expect(locker.lock('key', fn)).resolves.toBe('ok')

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith({ waited: false })
      expect(await redis.exists(`${prefix}key`)).toBe(0)
    })

    it('waits for the holder to release', async () => {
      const { locker } = createTestingLocker()
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const order: string[] = []

      const holder = locker.lock('key', async ({ waited }) => {
        order.push(`first:${waited}`)
        await release
        order.push('first:done')
      })

      await sleep(200)

      const waiter = locker.lock('key', ({ waited }) => {
        order.push(`second:${waited}`)
        return 'ok'
      })

      await sleep(300)
      expect(order).toEqual(['first:false'])

      resolve()
      await holder

      await expect(waiter).resolves.toBe('ok')
      expect(order).toEqual(['first:false', 'first:done', 'second:true'])
    })

    it('releases the lock when the callback throws', async () => {
      const { prefix, locker } = createTestingLocker()

      await expect(locker.lock('key', () => {
        throw new Error('boom')
      })).rejects.toThrow('boom')

      expect(await redis.exists(`${prefix}key`)).toBe(0)
      await expect(locker.lock('key', () => 'ok', { timeout: 0 })).resolves.toBe('ok')
    })

    it('rejects with LockTimeoutError when the lock is not released in time', async () => {
      const { locker } = createTestingLocker({ timeout: 300 })
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)

      await sleep(200)

      const fn = vi.fn()

      await expect(locker.lock('key', fn)).rejects.toBeInstanceOf(LockTimeoutError)
      await expect(locker.lock('key', fn, { timeout: 0 })).rejects.toMatchObject({
        name: 'LockTimeoutError',
        key: 'key',
      })
      expect(fn).not.toHaveBeenCalled()

      resolve()
      await holder
    })

    it('hands the lock over when the ttl expires, and the expired holder cannot release it', async () => {
      const { prefix, locker } = createTestingLocker({ ttl: 500 })
      const { promise: release1, resolve: resolve1 } = promiseWithResolvers<void>()
      const { promise: release2, resolve: resolve2 } = promiseWithResolvers<void>()
      const holder1 = locker.lock('key', () => release1)

      await sleep(200)

      const fn = vi.fn(() => release2.then(() => 'ok'))
      const holder2 = locker.lock('key', fn, { ttl: 10_000 })

      await vi.waitFor(() => expect(fn).toHaveBeenCalledWith({ waited: true }), { timeout: 5000 })

      resolve1()
      await holder1
      expect(await redis.exists(`${prefix}key`)).toBe(1)

      resolve2()
      await expect(holder2).resolves.toBe('ok')
      expect(await redis.exists(`${prefix}key`)).toBe(0)
    })

    it('aborts waiting when the signal is aborted', async () => {
      const { locker } = createTestingLocker()
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)

      await sleep(200)

      const controller = new AbortController()
      const fn = vi.fn()
      const waiter = locker.lock('key', fn, { signal: controller.signal })

      await sleep(200)
      controller.abort(new Error('aborted'))

      await expect(waiter).rejects.toThrow('aborted')
      expect(fn).not.toHaveBeenCalled()

      resolve()
      await holder
    })

    it('uses an empty prefix when none is provided', async () => {
      const locker = new UpstashLocker(redis, { ttl: 10_000 })
      const key = `no-prefix-${crypto.randomUUID()}`

      await locker.lock(key, async () => {
        expect(await redis.exists(key)).toBe(1)
      })

      expect(await redis.exists(key)).toBe(0)
    })

    it('never runs callbacks for the same key concurrently', async () => {
      const { locker } = createTestingLocker()
      let active = 0
      let maxActive = 0
      let count = 0

      await Promise.all(Array.from({ length: 5 }, () => locker.lock('key', async () => {
        active++
        maxActive = Math.max(maxActive, active)
        const current = count
        await sleep(20)
        count = current + 1
        active--
      })))

      expect(maxActive).toBe(1)
      expect(count).toBe(5)
    })
  },
)
