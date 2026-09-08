import type { RPCJsonSerializer } from '@orpc/client'
import type { Public } from '@orpc/shared'
import type { CacheEntry } from './types'
import { deepSortKeys, nowInSeconds, stringifyJSON } from '@orpc/shared'

/**
 * Encodes a cache key into a stable string: strings are used verbatim, while
 * any other value is serialized with the RPC JSON serializer first, so
 * complex values become plain JSON, then canonicalized by sorting object
 * keys and meta entries. Structurally equal keys always encode identically,
 * and unsupported values like blobs are ignored.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export function encodeCacheKey(key: unknown, serializer: Public<RPCJsonSerializer>): string {
  if (typeof key === 'string') {
    return key
  }

  const { json, meta } = serializer.serialize(key)

  return stringifyJSON([deepSortKeys(json), meta?.map(entry => stringifyJSON(entry)).sort()])
}

/**
 * Whether the entry is past its fresh lifetime.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export function isCacheEntryStale(entry: CacheEntry): boolean {
  return entry.expiresAt !== undefined && nowInSeconds() >= entry.expiresAt
}
