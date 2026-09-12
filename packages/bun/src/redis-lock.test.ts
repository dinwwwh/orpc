import { LockTimeoutError } from '@orpc/lock'
import { promiseWithResolvers, sleep } from '@orpc/shared'
import { RedisClient } from 'bun'
import { afterAll, beforeAll, describe, expect, it, vi } from 'bun:test'
import { BunRedisLocker } from './redis-lock'

const REDIS_URL = Bun.env.REDIS_URL

describe.skipIf(!REDIS_URL)('bun redis locker integration', async () => {
  const redis = new RedisClient(REDIS_URL)

  beforeAll(async () => {
    await redis.connect()
  })

  afterAll(async () => {
    redis.close()
  })

  function createTestingLocker(
    options: Partial<ConstructorParameters<typeof BunRedisLocker>[1]> = {},
  ) {
    const prefix = `orpc-bun-redis-locker-${crypto.randomUUID()}:`

    return {
      prefix,
      locker: new BunRedisLocker(redis, {
        prefix,
        ttl: 10_000,
        retryInterval: 10,
        ...options,
      }),
    }
  }

  it('runs the callback immediately when the lock is free and releases afterwards', async () => {
    const { prefix, locker } = createTestingLocker()
    const fn = vi.fn(async () => {
      expect(await redis.exists(`${prefix}key`)).toBe(true)
      return 'ok'
    })

    await expect(locker.lock('key', fn)).resolves.toBe('ok')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ waited: false })
    expect(await redis.exists(`${prefix}key`)).toBe(false)
  }, { timeout: 20_000 })

  it('waits for the holder to release', async () => {
    const { locker } = createTestingLocker()
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const order: string[] = []

    const holder = locker.lock('key', async ({ waited }) => {
      order.push(`first:${waited}`)
      await release
      order.push('first:done')
    })

    await sleep(50)

    const waiter = locker.lock('key', ({ waited }) => {
      order.push(`second:${waited}`)
      return 'ok'
    })

    await sleep(100)
    expect(order).toEqual(['first:false'])

    resolve()
    await holder

    await expect(waiter).resolves.toBe('ok')
    expect(order).toEqual(['first:false', 'first:done', 'second:true'])
  }, { timeout: 20_000 })

  it('releases the lock when the callback throws', async () => {
    const { prefix, locker } = createTestingLocker()

    await expect(locker.lock('key', () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')

    expect(await redis.exists(`${prefix}key`)).toBe(false)
    await expect(locker.lock('key', () => 'ok', { timeout: 0 })).resolves.toBe('ok')
  }, { timeout: 20_000 })

  it('rejects with LockTimeoutError when the lock is not released in time', async () => {
    const { locker } = createTestingLocker({ timeout: 200 })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(50)

    const fn = vi.fn()
    const start = Date.now()

    await expect(locker.lock('key', fn)).rejects.toBeInstanceOf(LockTimeoutError)
    await expect(locker.lock('key', fn, { timeout: 0 })).rejects.toMatchObject({
      name: 'LockTimeoutError',
      key: 'key',
    })

    expect(Date.now() - start).toBeGreaterThanOrEqual(150)
    expect(fn).not.toHaveBeenCalled()

    resolve()
    await holder
  }, { timeout: 20_000 })

  it('hands the lock over when the ttl expires, and the expired holder cannot release it', async () => {
    const { prefix, locker } = createTestingLocker({ ttl: 200 })
    const { promise: release1, resolve: resolve1 } = promiseWithResolvers<void>()
    const { promise: release2, resolve: resolve2 } = promiseWithResolvers<void>()
    const holder1 = locker.lock('key', () => release1)

    await sleep(50)

    const start = Date.now()
    const fn = vi.fn(() => release2.then(() => 'ok'))
    const holder2 = locker.lock('key', fn, { ttl: 10_000 })

    while (fn.mock.calls.length === 0) {
      await sleep(10)
    }

    expect(fn).toHaveBeenCalledWith({ waited: true })
    expect(Date.now() - start).toBeGreaterThanOrEqual(100)

    resolve1()
    await holder1
    expect(await redis.exists(`${prefix}key`)).toBe(true)

    resolve2()
    await expect(holder2).resolves.toBe('ok')
    expect(await redis.exists(`${prefix}key`)).toBe(false)
  }, { timeout: 20_000 })

  it('aborts waiting when the signal is aborted', async () => {
    const { locker } = createTestingLocker()
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(50)

    const controller = new AbortController()
    const fn = vi.fn()
    const waiter = locker.lock('key', fn, { signal: controller.signal })

    await sleep(50)
    controller.abort(new Error('aborted'))

    await expect(waiter).rejects.toThrow('aborted')
    expect(fn).not.toHaveBeenCalled()

    resolve()
    await holder
  }, { timeout: 20_000 })

  it('never runs callbacks for the same key concurrently', async () => {
    const { locker } = createTestingLocker()
    let active = 0
    let maxActive = 0
    let count = 0

    await Promise.all(Array.from({ length: 10 }, () => locker.lock('key', async () => {
      active++
      maxActive = Math.max(maxActive, active)
      const current = count
      await sleep(5)
      count = current + 1
      active--
    })))

    expect(maxActive).toBe(1)
    expect(count).toBe(10)
  }, { timeout: 20_000 })
})
