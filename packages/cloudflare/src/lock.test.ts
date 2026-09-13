import { LockTimeoutError } from '@orpc/experimental-lock'
import { promiseWithResolvers, sleep } from '@orpc/shared'
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import { experimental_DurableLocker as DurableLocker } from './lock'

describe('durableLocker', () => {
  function createTestingLocker(
    options: Partial<ConstructorParameters<typeof DurableLocker>[1]> = {},
  ) {
    const prefix = options.prefix ?? `orpc-durable-locker-${crypto.randomUUID()}:`

    return {
      prefix,
      locker: new DurableLocker(env.LOCK_DON, {
        ttl: 10_000,
        ...options,
        prefix,
      }),
    }
  }

  it('runs the callback immediately when the lock is free and releases afterwards', async () => {
    const { locker } = createTestingLocker()
    const fn = vi.fn(async () => {
      await expect(locker.lock('key', () => 'never', { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)
      return 'ok'
    })

    await expect(locker.lock('key', fn)).resolves.toBe('ok')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ waited: false })
    await expect(locker.lock('key', () => 'again', { timeout: 0 })).resolves.toBe('again')
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
    const { locker: other } = createTestingLocker({ prefix })
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
    const { locker } = createTestingLocker()

    await expect(locker.lock('key', () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')

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

  it('hands the lock over when the ttl expires, and the expired holder cannot release it', async () => {
    const { locker } = createTestingLocker({ ttl: 200 })
    const { promise: release1, resolve: resolve1 } = promiseWithResolvers<void>()
    const { promise: release2, resolve: resolve2 } = promiseWithResolvers<void>()
    const holder1 = locker.lock('key', () => release1)

    await sleep(50)

    const fn = vi.fn(() => release2.then(() => 'ok'))
    const holder2 = locker.lock('key', fn, { ttl: 10_000 })

    await vi.waitFor(() => expect(fn).toHaveBeenCalledWith({ waited: true }), { timeout: 2000 })

    resolve1()
    await holder1
    await expect(locker.lock('key', () => 'never', { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)

    resolve2()
    await expect(holder2).resolves.toBe('ok')
    await expect(locker.lock('key', () => 'again', { timeout: 0 })).resolves.toBe('again')
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

  it('makes one request per lock and never polls', async () => {
    const fetch = vi.fn()
    const getStubByName = vi.fn((namespace, key) => {
      const stub = namespace.getByName(key)

      return {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          fetch()
          return stub.fetch(input, init)
        },
      } as unknown as DurableObjectStub
    })
    const { locker } = createTestingLocker({ getStubByName })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(50)

    const waiter = locker.lock('key', ({ waited }) => waited)

    await sleep(300)
    expect(fetch).toHaveBeenCalledTimes(2)

    resolve()
    await holder

    await expect(waiter).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('serves many keys on one object without contention', async () => {
    const name = crypto.randomUUID()
    const { locker } = createTestingLocker({ getStubByName: namespace => namespace.getByName(name) })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('alice', () => release)

    await sleep(50)

    await expect(locker.lock('bob', ({ waited }) => waited, { timeout: 0 })).resolves.toBe(false)
    await expect(locker.lock('alice', vi.fn(), { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)

    resolve()
    await holder
  })

  it('names the Durable Object after the prefixed key', async () => {
    const getStubByName = vi.fn((namespace, key) => namespace.getByName(key))
    const { prefix, locker } = createTestingLocker({ getStubByName })

    await expect(locker.lock('key', () => 'ok')).resolves.toBe('ok')

    expect(getStubByName).toHaveBeenCalledWith(env.LOCK_DON, `${prefix}key`)
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
      await sleep(5)
      count = current + 1
      active--
    })))

    expect(maxActive).toBe(1)
    expect(count).toBe(5)
  })
})
