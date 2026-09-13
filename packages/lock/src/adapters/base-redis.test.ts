import { promiseWithResolvers, sleep } from '@orpc/shared'
import { LockTimeoutError } from '../error'
import { BaseRedisLocker } from './base-redis'

/**
 * Emulates the two Redis commands the base class relies on:
 * `SET key token NX PX ttl` and the compare-and-delete release script.
 */
class FakeRedisLocker extends BaseRedisLocker {
  constructor(
    private readonly store: Map<string, { token: string, expiresAt: number }>,
    options: Partial<ConstructorParameters<typeof BaseRedisLocker>[0]> = {},
  ) {
    super({ ttl: 10_000, retryInterval: 1, ...options })
  }

  protected async acquire(key: string, token: string, ttl: number): Promise<boolean> {
    const entry = this.store.get(key)

    if (entry && entry.expiresAt > Date.now()) {
      return false
    }

    this.store.set(key, { token, expiresAt: Date.now() + ttl })
    return true
  }

  protected async evalScript(_script: string, [key]: string[], [token]: string[]): Promise<unknown> {
    if (this.store.get(key!)?.token === token) {
      this.store.delete(key!)
      return 1
    }

    return 0
  }
}

describe('baseRedisLocker', () => {
  function createTestingLocker(options: Partial<ConstructorParameters<typeof BaseRedisLocker>[0]> = {}) {
    const store = new Map()

    return {
      store,
      locker: new FakeRedisLocker(store, options),
    }
  }

  it('runs the callback right away when the lock is free and releases it afterwards', async () => {
    const { locker } = createTestingLocker()
    const fn = vi.fn(() => 'ok')

    await expect(locker.lock('key', fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledExactlyOnceWith({ waited: false })

    await expect(locker.lock('key', () => 'again', { timeout: 0 })).resolves.toBe('again')
  })

  it('makes callers wait until the holder releases', async () => {
    const { locker } = createTestingLocker()
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const order: string[] = []

    const holder = locker.lock('key', async ({ waited }) => {
      order.push(`holder:${waited}`)
      await release
      order.push('holder:done')
    })
    const waiter = locker.lock('key', ({ waited }) => {
      order.push(`waiter:${waited}`)
      return 'ok'
    })

    await sleep(10)
    expect(order).toEqual(['holder:false'])

    resolve()
    await holder

    await expect(waiter).resolves.toBe('ok')
    expect(order).toEqual(['holder:false', 'holder:done', 'waiter:true'])
  })

  it('shares locks between lockers using the same store and prefix only', async () => {
    const { store, locker } = createTestingLocker({ prefix: 'a:' })
    const same = new FakeRedisLocker(store, { prefix: 'a:' })
    const other = new FakeRedisLocker(store, { prefix: 'b:' })
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await expect(same.lock('key', () => 'never', { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)
    await expect(other.lock('key', () => 'ok', { timeout: 0 })).resolves.toBe('ok')

    resolve()
    await holder

    await expect(same.lock('key', () => 'ok', { timeout: 0 })).resolves.toBe('ok')
  })

  it('uses no prefix by default', async () => {
    const { store, locker } = createTestingLocker()
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('key', () => release)

    await sleep(0)
    expect([...store.keys()]).toEqual(['key'])

    resolve()
    await holder
  })

  it('tracks locks independently per key', async () => {
    const { locker } = createTestingLocker()
    const { promise: release, resolve } = promiseWithResolvers<void>()
    const holder = locker.lock('alice', () => release)
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

  it('never runs callbacks for the same key concurrently', async () => {
    const { locker } = createTestingLocker()
    let active = 0
    let maxActive = 0
    let count = 0

    await Promise.all(Array.from({ length: 20 }, () => locker.lock('key', async () => {
      active++
      maxActive = Math.max(maxActive, active)
      const current = count
      await sleep(1)
      count = current + 1
      active--
    })))

    expect(maxActive).toBe(1)
    expect(count).toBe(20)
  })

  describe('timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects with LockTimeoutError when the lock is not released in time', async () => {
      const { locker } = createTestingLocker({ timeout: 250, retryInterval: 100 })
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)
      const fn = vi.fn()
      const waiter = locker.lock('key', fn)
      const settled = vi.fn()
      waiter.then(settled, settled)

      await vi.advanceTimersByTimeAsync(249)
      expect(settled).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      await expect(waiter).rejects.toMatchObject({
        name: 'LockTimeoutError',
        key: 'key',
        message: 'Timed out waiting for the lock of key "key"',
      })
      expect(fn).not.toHaveBeenCalled()

      resolve()
      await holder
    })

    it('gives up immediately when timeout is 0', async () => {
      const { locker } = createTestingLocker()
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)
      const fn = vi.fn()

      await expect(locker.lock('key', fn, { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)
      expect(fn).not.toHaveBeenCalled()

      resolve()
      await holder
    })

    it('per-call timeout overrides the default', async () => {
      const { locker } = createTestingLocker({ timeout: 10_000 })
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)
      const waiter = locker.lock('key', vi.fn(), { timeout: 100 })
      waiter.catch(() => {})

      await vi.advanceTimersByTimeAsync(100)
      await expect(waiter).rejects.toBeInstanceOf(LockTimeoutError)

      resolve()
      await holder
    })

    it('retries every retryInterval, which defaults to 100ms', async () => {
      const { locker } = createTestingLocker({ retryInterval: undefined })
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)
      const fn = vi.fn(() => 'ok')
      const waiter = locker.lock('key', fn)

      await vi.advanceTimersByTimeAsync(0)
      resolve()
      await holder

      await vi.advanceTimersByTimeAsync(99)
      expect(fn).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      await expect(waiter).resolves.toBe('ok')
      expect(fn).toHaveBeenCalledWith({ waited: true })
    })
  })

  describe('ttl', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('hands the lock over when the ttl expires, and the expired holder cannot release it', async () => {
      const { locker } = createTestingLocker({ ttl: 1000 })
      const { promise: release1, resolve: resolve1 } = promiseWithResolvers<void>()
      const { promise: release2, resolve: resolve2 } = promiseWithResolvers<void>()
      const holder1 = locker.lock('key', () => release1)
      const fn = vi.fn(() => release2)
      const holder2 = locker.lock('key', fn, { ttl: 10_000 })

      await vi.advanceTimersByTimeAsync(999)
      expect(fn).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(fn).toHaveBeenCalledWith({ waited: true })

      resolve1()
      await holder1
      await expect(locker.lock('key', () => 'never', { timeout: 0 })).rejects.toBeInstanceOf(LockTimeoutError)

      resolve2()
      await holder2
      await expect(locker.lock('key', () => 'ok', { timeout: 0 })).resolves.toBe('ok')
    })

    it('per-call ttl overrides the default', async () => {
      const { locker } = createTestingLocker({ ttl: 10_000 })
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release, { ttl: 100 })
      const fn = vi.fn(() => 'ok')
      const waiter = locker.lock('key', fn)

      await vi.advanceTimersByTimeAsync(100)
      await expect(waiter).resolves.toBe('ok')
      expect(fn).toHaveBeenCalledWith({ waited: true })

      resolve()
      await holder
    })
  })

  describe('signal', () => {
    it('stops waiting when the signal is aborted', async () => {
      const { locker } = createTestingLocker()
      const { promise: release, resolve } = promiseWithResolvers<void>()
      const holder = locker.lock('key', () => release)
      const controller = new AbortController()
      const fn = vi.fn()
      const waiter = locker.lock('key', fn, { signal: controller.signal })

      await sleep(0)
      controller.abort(new Error('aborted'))

      await expect(waiter).rejects.toThrow('aborted')
      expect(fn).not.toHaveBeenCalled()

      resolve()
      await holder
    })

    it('rejects immediately when the signal is already aborted', async () => {
      const { locker } = createTestingLocker()
      const controller = new AbortController()
      controller.abort(new Error('aborted'))
      const fn = vi.fn()

      await expect(locker.lock('key', fn, { signal: controller.signal })).rejects.toThrow('aborted')
      expect(fn).not.toHaveBeenCalled()

      await expect(locker.lock('key', () => 'ok', { timeout: 0 })).resolves.toBe('ok')
    })

    it('ignores the signal once the lock is acquired', async () => {
      const { locker } = createTestingLocker()
      const controller = new AbortController()

      await expect(locker.lock('key', async () => {
        controller.abort()
        await sleep(1)
        return 'ok'
      }, { signal: controller.signal })).resolves.toBe('ok')
    })
  })
})
