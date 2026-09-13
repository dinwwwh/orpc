import type { BaseLockerOptions } from './base'
import { BaseLocker } from './base'

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
export interface BaseRedisLockerOptions extends BaseLockerOptions {}

/**
 * Base class for Redis-backed locker adapters. It releases locks with an atomic
 * Lua script, so every adapter built on it can share locks with the others
 * regardless of the Redis client in use.
 *
 * Extend it and implement the abstract methods to support another Redis client.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export abstract class BaseRedisLocker extends BaseLocker {
  /**
   * Sets `key` to `token` only when it does not exist yet, with an expiry
   * of `ttlMs` milliseconds (`SET key token NX PX ttlMs`), and resolves with
   * whether the key was set.
   */
  protected abstract override acquire(key: string, token: string, ttlMs: number): Promise<boolean>

  /**
   * Runs a Lua script (`EVAL script numkeys key [key ...] arg [arg ...]`).
   */
  protected abstract evalScript(script: string, keys: string[], args: string[]): Promise<unknown>

  protected async release(key: string, token: string): Promise<void> {
    await this.evalScript(RELEASE_LOCK_SCRIPT, [key], [token])
  }
}
