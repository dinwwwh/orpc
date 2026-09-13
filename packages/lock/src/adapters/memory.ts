import type { Promisable } from '@orpc/shared'
import type { LockCallbackOptions, Locker, LockOptions } from '../types'
import { promiseWithResolvers } from '@orpc/shared'
import { LockTimeoutError } from '../error'

export interface MemoryLockerOptions {
  /**
   * How long a lock is held before it expires automatically, in seconds.
   * Guards against holders that never release the lock.
   * Can be overridden per call.
   *
   * @default undefined (held until released)
   */
  ttl?: number

  /**
   * How long to wait for a lock to become available, in seconds.
   * Can be overridden per call.
   *
   * @default 10
   */
  timeout?: number
}

interface MemoryLockWaiter {
  token: object
  resolve: () => void
}

interface MemoryLockEntry {
  holder: object
  expiry?: ReturnType<typeof setTimeout>
  waiters: MemoryLockWaiter[]
}

/**
 * Locker adapter backed by in-memory storage, so locks are only shared within
 * the current process. Waiters acquire the lock in order, without polling.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class MemoryLocker implements Locker {
  private readonly ttl: number | undefined
  private readonly timeout: number

  private readonly entries = new Map<string, MemoryLockEntry>()

  constructor(options: MemoryLockerOptions = {}) {
    this.ttl = options.ttl
    this.timeout = options.timeout ?? 10
  }

  async lock<T>(key: string, fn: (options: LockCallbackOptions) => Promisable<T>, options: LockOptions = {}): Promise<T> {
    const ttl = options.ttl ?? this.ttl
    const timeout = options.timeout ?? this.timeout
    const token = {}

    options.signal?.throwIfAborted()

    let entry = this.entries.get(key)
    const waited = entry !== undefined

    if (entry) {
      await this.wait(key, entry, token, timeout, options.signal)
    }
    else {
      entry = { holder: token, waiters: [] }
      this.entries.set(key, entry)
    }

    if (ttl !== undefined) {
      entry.expiry = setTimeout(() => this.release(key, token), ttl * 1000)
    }

    try {
      return await fn({ waited })
    }
    finally {
      this.release(key, token)
    }
  }

  private wait(key: string, entry: MemoryLockEntry, token: object, timeout: number, signal: AbortSignal | undefined): Promise<void> {
    if (timeout <= 0) {
      return Promise.reject(new LockTimeoutError(key))
    }

    const { promise, resolve, reject } = promiseWithResolvers<void>()
    const waiter: MemoryLockWaiter = { token, resolve }
    entry.waiters.push(waiter)

    const fail = (reason: unknown) => {
      const index = entry.waiters.indexOf(waiter)
      if (index !== -1) {
        entry.waiters.splice(index, 1)
      }

      reject(reason)
    }

    const timer = setTimeout(() => fail(new LockTimeoutError(key)), timeout * 1000)
    const abortListener = () => fail(signal?.reason)
    signal?.addEventListener('abort', abortListener, { once: true })

    return promise.finally(() => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abortListener)
    })
  }

  private release(key: string, token: object): void {
    const entry = this.entries.get(key)

    if (entry?.holder !== token) {
      return
    }

    clearTimeout(entry.expiry)

    const next = entry.waiters.shift()

    if (!next) {
      this.entries.delete(key)
      return
    }

    entry.holder = next.token
    next.resolve()
  }
}
