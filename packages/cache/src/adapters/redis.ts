import type { RedisClientType } from 'redis'
import type { BaseRedisCacheStoreOptions } from './base-redis'
import { BaseRedisCacheStore } from './base-redis'

export type RedisCacheStoreOptions = BaseRedisCacheStoreOptions

/**
 * Cache store adapter for Redis. Connects the client lazily when needed and
 * runs the scripts by sha, loading each once per client and again if the
 * server dropped it.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export class RedisCacheStore extends BaseRedisCacheStore {
  private readonly scriptShas = new Map<string, Awaited<ReturnType<typeof this.redis.scriptLoad>>>()

  constructor(
    private readonly redis: RedisClientType<any, any, any, any, any>,
    options: RedisCacheStoreOptions = {},
  ) {
    super(options)
  }

  protected async run(script: string, keys: string[], args: string[], reloaded = false): Promise<unknown> {
    if (!this.redis.isOpen) {
      await this.redis.connect()
    }

    let sha = this.scriptShas.get(script)

    if (sha === undefined) {
      sha = await this.redis.scriptLoad(script)
      this.scriptShas.set(script, sha)
    }

    try {
      return await this.redis.evalSha(sha, { keys, arguments: args })
    }
    catch (error) {
      if (!reloaded && error instanceof Error && error.message.startsWith('NOSCRIPT')) {
        this.scriptShas.delete(script)
        return await this.run(script, keys, args, true)
      }

      throw error
    }
  }
}
