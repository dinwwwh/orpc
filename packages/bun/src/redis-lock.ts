import type { BaseRedisLockerOptions } from '@orpc/lock/base-redis'
import type { RedisClient } from 'bun'
import { BaseRedisLocker } from '@orpc/lock/base-redis'

/**
 * Locker adapter for Bun's built-in Redis client. Acquires locks with `SET NX PX`
 * and releases them atomically with a Lua script. It shares locks with `RedisLocker`.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class BunRedisLocker extends BaseRedisLocker {
  constructor(
    private readonly redis: RedisClient,
    options: BaseRedisLockerOptions,
  ) {
    super(options)
  }

  protected async setIfNotExists(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.redis.send('SET', [key, value, 'NX', 'PX', String(ttl)])

    return result === 'OK'
  }

  protected async evalScript(script: string, keys: string[], args: string[]): Promise<unknown> {
    return await this.redis.send('EVAL', [script, String(keys.length), ...keys, ...args])
  }
}
