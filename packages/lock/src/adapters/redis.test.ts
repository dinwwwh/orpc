import { promiseWithResolvers, sleep } from '@orpc/shared'
import { createClient } from 'redis'
import { LockTimeoutError } from '../error'
import { RedisLocker } from './redis'

const REDIS_URL = process.env.REDIS_URL

describe.concurrent('redis locker integration', {
  skip: !REDIS_URL,
  timeout: 20_000,
}, async () => {
  const redis = createClient({
    url: REDIS_URL,
  })

  beforeAll(async () => {
    await redis.connect()
  })

  function createTestingLocker(
    options: Partial<ConstructorParameters<typeof RedisLocker>[1]> = {},
  ) {
    const prefix = `orpc-redis-locker-${crypto.randomUUID()}:`

    return {
      prefix,
      locker: new RedisLocker(redis, {
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
  })

  it('shares locks across instances using the same prefix', async () => {
    const { prefix, locker } = createTestingLocker()
    const other = new RedisLocker(redis, { prefix, ttl: 10_000, retryInterval: 10 })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(50)

    const fn = vi.fn()
    await expect(other.lock('key', fn, { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)
    expect(fn).not.toHaveBeenCalled()

    resolve()
    await holder

    await expect(other.lock('key', () => 'ok')).resolves.toBe('ok')
  })

  it('tracks locks independently per key', async () => {
    const { locker } = createTestingLocker()
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('alice', () => release)

    await sleep(50)

    const fn = vi.fn(() => 'bob')
    await expect(locker.lock('bob', fn, { timeout: 0 })).resolves.toBe('bob')
    expect(fn).toHaveBeenCalledWith({ waited: false })

    resolve()
    await holder
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
    const { locker } = createTestingLocker({ timeout: 200 })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(50)

    const fn = vi.fn()
    const start = Date.now()

    await expect(locker.lock('key', fn)).rejects.toMatchObject({
      name: 'LockTimeoutError',
      key: 'key',
      message: 'Timed out waiting for the lock of key "key"',
    })

    expect(Date.now() - start).toBeGreaterThanOrEqual(150)
    expect(fn).not.toHaveBeenCalled()

    resolve()
    await holder
  })

  it('per-call timeout overrides the default', async () => {
    const { locker } = createTestingLocker({ timeout: 10_000 })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(50)

    const start = Date.now()
    await expect(locker.lock('key', vi.fn(), { timeout: 100 })).rejects.toBeInstanceOf(LockTimeoutError)
    expect(Date.now() - start).toBeLessThan(1000)

    resolve()
    await holder
  })

  it('hands the lock over when the ttl expires, and the expired holder cannot release it', async () => {
    const { prefix, locker } = createTestingLocker({ ttl: 200 })
    const { promise: release1, resolve: resolve1 } = promiseWithResolvers<void>()
    const { promise: release2, resolve: resolve2 } = promiseWithResolvers<void>()
    const holder1 = locker.lock('key', () => release1)

    await sleep(50)

    const start = Date.now()
    const fn = vi.fn(() => release2.then(() => 'ok'))
    const holder2 = locker.lock('key', fn, { ttl: 10_000 })

    await vi.waitFor(() => expect(fn).toHaveBeenCalledWith({ waited: true }), { timeout: 2000 })
    expect(Date.now() - start).toBeGreaterThanOrEqual(100)

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
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const { prefix, locker } = createTestingLocker()
    const controller = new AbortController()
    controller.abort(new Error('aborted'))
    const fn = vi.fn()

    await expect(locker.lock('key', fn, { signal: controller.signal })).rejects.toThrow('aborted')
    expect(fn).not.toHaveBeenCalled()
    expect(await redis.exists(`${prefix}key`)).toBe(0)
  })

  it('uses an empty prefix when none is provided', async () => {
    const locker = new RedisLocker(redis, { ttl: 10_000 })
    const key = `no-prefix-${crypto.randomUUID()}`

    await locker.lock(key, async () => {
      expect(await redis.exists(key)).toBe(1)
    })

    expect(await redis.exists(key)).toBe(0)
  })

  it('rethrows client errors', async () => {
    const disconnectedRedis = createClient({
      url: 'rediss://invalid',
    })
    const locker = new RedisLocker(disconnectedRedis, { ttl: 1000 })

    await expect(locker.lock('key', vi.fn())).rejects.toThrow()
  })

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
  })

  it('lazily connects to Redis once under concurrent lock calls', async () => {
    const redis = createClient({
      url: REDIS_URL,
    })

    const locker = new RedisLocker(redis, {
      prefix: `orpc-redis-locker-${crypto.randomUUID()}:`,
      ttl: 10_000,
      retryInterval: 10,
    })

    expect(redis.isOpen).toBe(false)

    await Promise.all([
      expect(locker.lock('a', () => 'a')).resolves.toBe('a'),
      expect(locker.lock('b', () => 'b')).resolves.toBe('b'),
      expect(locker.lock('c', () => 'c')).resolves.toBe('c'),
    ])

    expect(redis.isOpen).toBe(true)
  })
})
