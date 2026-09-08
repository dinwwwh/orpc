import type { Lock, Public } from '@orpc/shared'
import type { RuntimeCache } from '@vercel/functions'
import type { CacheEntry, CacheFetchOptions, CacheRevalidateOptions, CacheStore } from '../types'
import { RPCJsonSerializer, RPCSerializer } from '@orpc/client'
import { MemoryLock, nowInSeconds } from '@orpc/shared'
import { getCache } from '@vercel/functions'
import { encodeCacheKey, isCacheEntryStale } from '../utils'

interface VercelCacheStoreEnvelope {
  /**
   * The cached output, encoded with the store's serializer.
   */
  output: unknown
  tags?: readonly string[]
  expiresAt?: number | undefined
  evictAt?: number | undefined
}

export interface VercelCacheStoreOptions {
  /**
   * The Vercel Runtime Cache to use.
   *
   * @default getCache()
   */
  cache?: RuntimeCache

  /**
   * Serializer for cached outputs.
   *
   * @default RPCSerializer
   */
  serializer?: undefined | Public<RPCSerializer>

  /**
   * Coalesces concurrent callers of one key, so a miss is filled once and a
   * stale entry refreshed once. The Runtime Cache has no atomic primitive,
   * so the default holds the lock within the process.
   *
   * @default new MemoryLock()
   */
  lock?: Lock
}

/**
 * Cache store adapter for the Vercel Runtime Cache. Tags are expired
 * natively via `expireTag`, and entries are retained for `ttl + swr`.
 * Outside Vercel, the default `getCache()` falls back to an in-memory
 * cache. Concurrent callers of one key are coalesced through the `lock`
 * option, within the process by default.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export class VercelCacheStore implements CacheStore {
  private readonly cache: RuntimeCache
  private readonly serializer: Public<RPCSerializer>
  private readonly lock: Lock

  /**
   * Key encoding has no serializer option, so one is built here rather than
   * per call by {@link encodeCacheKey}.
   */
  private readonly keySerializer = new RPCJsonSerializer()

  constructor(options: VercelCacheStoreOptions = {}) {
    this.cache = options.cache ?? getCache()
    this.serializer = options.serializer ?? new RPCSerializer()
    this.lock = options.lock ?? new MemoryLock()
  }

  async fetch(key: unknown, fill: () => Promise<unknown>, options: CacheFetchOptions = {}): Promise<CacheEntry> {
    const encodedKey = encodeCacheKey(key, this.keySerializer)
    const entry = await this.read(encodedKey)

    if (entry === undefined) {
      return this.lock.run(encodedKey, async (waited) => {
        const current = waited ? await this.read(encodedKey) : undefined
        return current ?? this.write(encodedKey, await fill(), options)
      })
    }

    if (isCacheEntryStale(entry)) {
      const refresh = this.lock.run(encodedKey, async (waited) => {
        const current = waited ? await this.read(encodedKey) : undefined

        if (current === undefined || isCacheEntryStale(current)) {
          await this.write(encodedKey, await fill(), options)
        }
      })

      options.waitUntil?.(refresh)
    }

    return entry
  }

  async revalidate({ tags }: CacheRevalidateOptions): Promise<void> {
    await this.cache.expireTag([...tags])
  }

  private async read(encodedKey: string): Promise<CacheEntry | undefined> {
    const envelope = await this.cache.get(encodedKey) as VercelCacheStoreEnvelope | null | undefined

    if (envelope == null) {
      return undefined
    }

    if (envelope.evictAt !== undefined && nowInSeconds() >= envelope.evictAt) {
      await this.cache.delete(encodedKey)
      return undefined
    }

    return {
      output: this.serializer.deserialize(envelope.output as any),
      tags: envelope.tags,
      expiresAt: envelope.expiresAt,
    }
  }

  private async write(encodedKey: string, output: unknown, options: CacheFetchOptions): Promise<CacheEntry> {
    const serialized = this.serializer.serialize(output)

    const tags = options.tags
    const retention = options.ttl !== undefined ? options.ttl + (options.swr ?? 0) : undefined
    const expiresAt = options.ttl !== undefined ? nowInSeconds() + options.ttl : undefined
    const evictAt = retention !== undefined ? nowInSeconds() + retention : undefined

    const envelope: VercelCacheStoreEnvelope = {
      output: serialized,
      tags,
      expiresAt,
      evictAt,
    }

    await this.cache.set(encodedKey, envelope, {
      ...(tags?.length ? { tags: [...tags] } : {}),
      ...(retention !== undefined ? { ttl: retention } : {}),
    })

    return { output, tags, expiresAt }
  }
}
