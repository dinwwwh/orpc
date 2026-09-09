import type { Promisable, Public } from '@orpc/shared'
import type { CacheEntry, CacheFetchOptions, CacheRevalidateOptions, CacheStore } from '../types'
import { RPCJsonSerializer } from '@orpc/client'
import { encodeCacheKey, isCacheEntryStale } from '../utils'

export interface BaseKeyValueCacheStoreOptions {
  /**
   * Serializer for keys, and for cached outputs where the backend stores
   * them serialized.
   *
   * @default RPCJsonSerializer
   */
  serializer?: undefined | Public<RPCJsonSerializer>
}

/**
 * Cache store over a key-value backend without an atomic primitive, so
 * concurrent callers of one key are coalesced within the process. Subclasses
 * read and write entries by their encoded key.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export abstract class BaseKeyValueCacheStore<TSnapshot = undefined> implements CacheStore {
  private readonly pending = new Map<string, Promise<unknown>>()
  protected readonly serializer: Public<RPCJsonSerializer>

  constructor(options: BaseKeyValueCacheStoreOptions = {}) {
    this.serializer = options.serializer ?? new RPCJsonSerializer()
  }

  async fetch(key: unknown, fill: () => Promise<unknown>, options: CacheFetchOptions = {}): Promise<CacheEntry> {
    const encodedKey = encodeCacheKey(key, this.serializer)
    const entry = await this.read(encodedKey)

    if (entry === undefined) {
      return this.coalesce(encodedKey, async (waited) => {
        const current = waited ? await this.read(encodedKey) : undefined

        if (current !== undefined) {
          return current
        }

        const snapshot = await this.snapshot(options)
        return this.write(encodedKey, await fill(), options, snapshot)
      })
    }

    if (isCacheEntryStale(entry)) {
      const refresh = this.coalesce(encodedKey, async (waited) => {
        const current = waited ? await this.read(encodedKey) : undefined

        if (current === undefined || isCacheEntryStale(current)) {
          const snapshot = await this.snapshot(options)
          await this.write(encodedKey, await fill(), options, snapshot)
        }
      })

      options.waitUntil?.(refresh)
    }

    return entry
  }

  abstract revalidate(options: CacheRevalidateOptions): Promise<void>

  protected abstract read(encodedKey: string): Promisable<CacheEntry | undefined>

  /**
   * Captures the tag state a fill starts from, so a revalidation that lands
   * while the fill runs still invalidates what it stores.
   */
  protected abstract snapshot(options: CacheFetchOptions): Promisable<TSnapshot>

  protected abstract write(encodedKey: string, output: unknown, options: CacheFetchOptions, snapshot: TSnapshot): Promisable<CacheEntry>

  /**
   * Runs `fn` once the key is free, in call order. `waited` is `true` when
   * another caller held it first.
   */
  private async coalesce<T>(encodedKey: string, fn: (waited: boolean) => Promise<T>): Promise<T> {
    const previous = this.pending.get(encodedKey)
    const run = () => fn(previous !== undefined)
    const current = previous?.then(run, run) ?? run()

    this.pending.set(encodedKey, current)

    try {
      return await current
    }
    finally {
      if (this.pending.get(encodedKey) === current) {
        this.pending.delete(encodedKey)
      }
    }
  }
}
