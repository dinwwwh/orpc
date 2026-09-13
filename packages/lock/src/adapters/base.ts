import type { Promisable } from '@orpc/shared'
import type { LockCallbackOptions, Locker, LockOptions } from '../types'
import { sleep } from '@orpc/shared'
import { LockTimeoutError } from '../error'

/**
 * Options shared by every locker adapter built on `BaseLocker`.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export interface BaseLockerOptions {
  /**
   * The prefix to use for lock keys.
   *
   * @default ''
   */
  prefix?: string

  /**
   * How long a lock is held before it expires automatically, in seconds.
   * Guards against holders that never release the lock, such as a crashed process.
   * Can be overridden per call.
   */
  ttl: number

  /**
   * How long to wait for a lock to become available, in seconds.
   * Can be overridden per call.
   *
   * @default 10
   */
  timeout?: number

  /**
   * How long to wait between acquisition attempts while the lock
   * is held by someone else, in seconds.
   *
   * @default 0.1
   */
  retryInterval?: number
}

/**
 * Base class for locker adapters backed by a store that can atomically set a key
 * only when it is absent and delete it only for its owner. It owns the key naming,
 * the lock token, and the acquisition loop, so a subclass only implements
 * `acquire` and `release` for its store.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export abstract class BaseLocker implements Locker {
  protected readonly prefix: string
  protected readonly ttl: number
  protected readonly timeout: number
  protected readonly retryInterval: number

  constructor(options: BaseLockerOptions) {
    this.prefix = options.prefix ?? ''
    this.ttl = options.ttl
    this.timeout = options.timeout ?? 10
    this.retryInterval = options.retryInterval ?? 0.1
  }

  /**
   * Stores `token` under `key` only when no unexpired holder exists, with an expiry
   * of `ttlMs` milliseconds, and resolves with whether the lock was acquired.
   */
  protected abstract acquire(key: string, token: string, ttlMs: number): Promise<boolean>

  /**
   * Deletes `key` only while it still holds `token`.
   */
  protected abstract release(key: string, token: string): Promise<void>

  async lock<T>(key: string, fn: (options: LockCallbackOptions) => Promisable<T>, options: LockOptions = {}): Promise<T> {
    const prefixedKey = `${this.prefix}${key}`
    const ttlMs = Math.round((options.ttl ?? this.ttl) * 1000)
    const deadline = Date.now() + (options.timeout ?? this.timeout) * 1000
    const token = crypto.randomUUID()
    let waited = false

    options.signal?.throwIfAborted()

    while (!(await this.acquire(prefixedKey, token, ttlMs))) {
      const remaining = deadline - Date.now()

      if (remaining <= 0) {
        throw new LockTimeoutError(key)
      }

      waited = true
      await sleep(Math.min(this.retryInterval * 1000, remaining), { signal: options.signal })
    }

    try {
      return await fn({ waited })
    }
    finally {
      await this.release(prefixedKey, token)
    }
  }
}
