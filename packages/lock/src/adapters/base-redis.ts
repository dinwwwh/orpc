import type { Promisable } from '@orpc/shared'
import type { LockCallbackOptions, Locker, LockOptions } from '../types'
import { sleep } from '@orpc/shared'
import { LockTimeoutError } from '../error'

const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end

return 0
`

/**
 * Options shared by every Redis-backed locker adapter.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export interface BaseRedisLockerOptions {
  /**
   * The prefix to use for Redis keys.
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
 * Base class for Redis-backed locker adapters. It owns the key naming, the lock
 * token, the acquisition loop, and the atomic Lua release, so every adapter built
 * on it can share locks with the others regardless of the Redis client in use.
 *
 * Extend it and implement the abstract methods to support another Redis client.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export abstract class BaseRedisLocker implements Locker {
  protected readonly prefix: string
  protected readonly ttl: number
  protected readonly timeout: number
  protected readonly retryInterval: number

  constructor(options: BaseRedisLockerOptions) {
    this.prefix = options.prefix ?? ''
    this.ttl = options.ttl
    this.timeout = options.timeout ?? 10
    this.retryInterval = options.retryInterval ?? 0.1
  }

  /**
   * Sets `key` to `token` only when it does not exist yet, with an expiry
   * of `ttlMs` milliseconds (`SET key token NX PX ttlMs`), and resolves with
   * whether the key was set.
   */
  protected abstract acquire(key: string, token: string, ttlMs: number): Promise<boolean>

  /**
   * Runs a Lua script (`EVAL script numkeys key [key ...] arg [arg ...]`).
   */
  protected abstract evalScript(script: string, keys: string[], args: string[]): Promise<unknown>

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
      await this.evalScript(RELEASE_LOCK_SCRIPT, [prefixedKey], [token])
    }
  }
}
