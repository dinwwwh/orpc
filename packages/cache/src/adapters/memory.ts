import type { Public } from '@orpc/shared'
import type { CacheEntry, CacheFetchOptions, CacheRevalidateOptions, CacheStore } from '../types'
import { RPCJsonSerializer } from '@orpc/client'
import { MemoryLock, nowInSeconds } from '@orpc/shared'
import { encodeCacheKey, isCacheEntryStale } from '../utils'

export interface MemoryCacheStoreOptions {
  /**
   * Serializer used to encode non-string keys.
   *
   * @default RPCJsonSerializer
   */
  serializer?: undefined | Public<RPCJsonSerializer>
}

interface MemoryCacheStoreEntry {
  output: unknown
  /**
   * The tags, and the version counter each had at set time, index-aligned.
   * Both are absent together when the entry has no tags.
   */
  tags?: readonly string[]
  tagVersions?: readonly number[]
  expiresAt: number | undefined
  evictAt: number | undefined
}

/**
 * In-memory cache store with tag-based invalidation, intended for
 * development, testing, and single-instance deployments. Expired and
 * revalidated entries are removed lazily on the next `fetch` of their key,
 * and concurrent callers of one key are coalesced within the process.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryCacheStoreEntry>()
  private readonly tagVersions = new Map<string, number>()
  private readonly serializer: Public<RPCJsonSerializer>
  private readonly memoryLock = new MemoryLock()

  constructor(options: MemoryCacheStoreOptions = {}) {
    this.serializer = options.serializer ?? new RPCJsonSerializer()
  }

  async fetch(key: unknown, fill: () => Promise<unknown>, options: CacheFetchOptions = {}): Promise<CacheEntry> {
    const encodedKey = encodeCacheKey(key, this.serializer)
    const entry = this.read(encodedKey)

    if (entry === undefined) {
      return this.memoryLock.run(encodedKey, async (waited) => {
        const current = waited ? this.read(encodedKey) : undefined
        return current ?? this.write(encodedKey, await fill(), options)
      })
    }

    if (isCacheEntryStale(entry)) {
      const refresh = this.memoryLock.run(encodedKey, async (waited) => {
        const current = waited ? this.read(encodedKey) : undefined

        if (current === undefined || isCacheEntryStale(current)) {
          this.write(encodedKey, await fill(), options)
        }
      })

      options.waitUntil?.(refresh)
    }

    return entry
  }

  async revalidate({ tags }: CacheRevalidateOptions): Promise<void> {
    for (const tag of tags) {
      this.tagVersions.set(tag, (this.tagVersions.get(tag) ?? 0) + 1)
    }
  }

  private read(encodedKey: string): CacheEntry | undefined {
    const entry = this.entries.get(encodedKey)

    if (!entry) {
      return undefined
    }

    if (entry.evictAt !== undefined && nowInSeconds() >= entry.evictAt) {
      this.entries.delete(encodedKey)
      return undefined
    }

    const revalidated = entry.tags?.some(
      (tag, index) => (this.tagVersions.get(tag) ?? 0) !== entry.tagVersions?.[index],
    )

    if (revalidated) {
      this.entries.delete(encodedKey)
      return undefined
    }

    return {
      output: entry.output,
      tags: entry.tags,
      expiresAt: entry.expiresAt,
    }
  }

  private write(encodedKey: string, output: unknown, options: CacheFetchOptions): CacheEntry {
    const tags = options.tags
    const expiresAt = options.ttl !== undefined ? nowInSeconds() + options.ttl : undefined
    const evictAt = expiresAt !== undefined ? expiresAt + (options.swr ?? 0) : undefined

    this.entries.set(encodedKey, {
      output,
      tags,
      tagVersions: tags?.map(tag => this.tagVersions.get(tag) ?? 0),
      expiresAt,
      evictAt,
    })

    return { output, tags, expiresAt }
  }
}
