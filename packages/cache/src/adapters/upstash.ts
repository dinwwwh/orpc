import type { Public } from '@orpc/shared'
import type { Redis } from '@upstash/redis'
import type { CacheEntry, CacheFetchOptions, CacheRevalidateOptions, CacheStore } from '../types'
import { RPCJsonSerializer, RPCSerializer } from '@orpc/client'
import { nowInSeconds, sleep, stringifyJSON } from '@orpc/shared'
import { encodeCacheKey } from '../utils'

/**
 * Reads the entry as `[output, tags, expiresAt, shouldFill]`, dropping it when
 * a tag was revalidated since it was stored. A missing or stale entry also
 * takes the lock, and `shouldFill` reports whether this caller got it.
 */
const FETCH_SCRIPT = `
local fields = redis.call('HMGET', KEYS[1], 'output', 'tags', 'tagVersions', 'expiresAt')
local output, tags, versions, expiresAt = fields[1], fields[2], fields[3], fields[4]

if output and tags then
  local names = cjson.decode(tags)
  local snapshot = cjson.decode(versions)
  local keys = {}
  for i, name in ipairs(names) do
    keys[i] = ARGV[3] .. name
  end
  local live = redis.call('MGET', unpack(keys))
  for i, name in ipairs(names) do
    if tonumber(live[i] or 0) ~= (snapshot[name] or 0) then
      redis.call('DEL', KEYS[1])
      output = false
      break
    end
  end
end

local stale = output and expiresAt and tonumber(expiresAt) <= tonumber(ARGV[4])
local acquired = false
if not output or stale then
  acquired = redis.call('SET', KEYS[2], ARGV[1], 'NX', 'PX', ARGV[2]) and true or false
end

return { output or false, tags or false, expiresAt or false, acquired }
`

/**
 * Stores the entry with its tag versions snapshotted in the same step, then
 * releases the caller's lock.
 */
const STORE_SCRIPT = `
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'output', ARGV[2])

if ARGV[3] ~= '' then
  local names = cjson.decode(ARGV[3])
  local keys = {}
  for i, name in ipairs(names) do
    keys[i] = ARGV[6] .. name
  end
  local live = redis.call('MGET', unpack(keys))
  local snapshot = {}
  for i, name in ipairs(names) do
    snapshot[name] = tonumber(live[i] or 0)
  end
  redis.call('HSET', KEYS[1], 'tags', ARGV[3], 'tagVersions', cjson.encode(snapshot))
end

if ARGV[4] ~= '' then
  redis.call('HSET', KEYS[1], 'expiresAt', ARGV[4])
end

if ARGV[5] ~= '' then
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
end

if redis.call('GET', KEYS[2]) == ARGV[1] then
  redis.call('DEL', KEYS[2])
end
`

/**
 * Deletes the lock only while it still holds the caller's token, leaving one
 * that expired and was taken over alone.
 */
const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

/**
 * Replies arrive parsed unless the client's `automaticDeserialization` is off.
 */
function parseReply(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value
}

export interface UpstashCacheStoreOptions {
  /**
   * The prefix to use for Redis keys.
   *
   * @default undefined
   */
  prefix?: string

  /**
   * Serializer for cached outputs.
   *
   * @default RPCSerializer
   */
  serializer?: undefined | Public<RPCSerializer>

  /**
   * How long a lock may be held, in seconds, so a crashed holder frees its
   * waiters. A fill outlasting it lets the next waiter fill as well.
   *
   * @default 10
   */
  lockTtl?: number
}

/**
 * Cache store adapter for Upstash Redis with tag-based invalidation. Shares
 * its key and entry format with `RedisCacheStore`, so both can serve the
 * same database. Entries are hashes retained for `ttl + swr`; tag counters
 * have no expiry since expiring one would resurrect stale entries.
 * Revalidated entries are removed lazily on the next `fetch` of their key.
 * Concurrent callers of one key are coalesced through a lock taken in the
 * same script that reads the entry, so it spans processes.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export class UpstashCacheStore implements CacheStore {
  private readonly prefix: string
  private readonly tagPrefix: string
  private readonly serializer: Public<RPCSerializer>
  private readonly lockTtl: number

  private readonly keySerializer = new RPCJsonSerializer()

  private readonly fetchScript: ReturnType<Redis['createScript']>
  private readonly storeScript: ReturnType<Redis['createScript']>
  private readonly releaseLockScript: ReturnType<Redis['createScript']>

  constructor(
    private readonly redis: Redis,
    options: UpstashCacheStoreOptions = {},
  ) {
    this.prefix = options.prefix ?? ''
    this.tagPrefix = `${this.prefix}t:`
    this.serializer = options.serializer ?? new RPCSerializer()
    this.lockTtl = options.lockTtl ?? 10
    this.fetchScript = redis.createScript(FETCH_SCRIPT)
    this.storeScript = redis.createScript(STORE_SCRIPT)
    this.releaseLockScript = redis.createScript(RELEASE_LOCK_SCRIPT)
  }

  async fetch(key: unknown, fill: () => Promise<unknown>, options: CacheFetchOptions = {}): Promise<CacheEntry> {
    const encodedKey = encodeCacheKey(key, this.keySerializer)
    const entryKey = `${this.prefix}e:${encodedKey}`
    const lockKey = `${this.prefix}l:${encodedKey}`
    const token = crypto.randomUUID()

    while (true) {
      const [output, tags, expiresAt, shouldFill] = await this.fetchScript.exec(
        [entryKey, lockKey],
        [token, String(this.lockTtl * 1000), this.tagPrefix, String(nowInSeconds())],
      ) as [unknown, unknown, unknown, unknown]

      if (output !== null) {
        const entry: CacheEntry = {
          output: this.serializer.deserialize((parseReply(output) as { body?: unknown }).body as any),
          tags: tags === null ? undefined : parseReply(tags) as string[],
          expiresAt: expiresAt === null ? undefined : Number(expiresAt),
        }

        if (shouldFill) {
          const refresh = this.store(entryKey, lockKey, token, fill, options)
          options.waitUntil?.(refresh)
        }

        return entry
      }

      if (shouldFill) {
        return this.store(entryKey, lockKey, token, fill, options)
      }

      await sleep(50)
    }
  }

  async revalidate({ tags }: CacheRevalidateOptions): Promise<void> {
    if (tags.length === 1) {
      await this.redis.incr(`${this.tagPrefix}${tags[0]}`)
      return
    }

    const multi = this.redis.multi()
    for (const tag of tags) {
      multi.incr(`${this.tagPrefix}${tag}`)
    }
    await multi.exec()
  }

  private async store(entryKey: string, lockKey: string, token: string, fill: () => Promise<unknown>, options: CacheFetchOptions): Promise<CacheEntry> {
    let output: unknown
    let serialized: string

    try {
      output = await fill()
      serialized = stringifyJSON({ body: this.serializer.serialize(output) })
    }
    catch (error) {
      await this.releaseLockScript.exec([lockKey], [token])
      throw error
    }

    const tags = options.tags?.length ? options.tags : undefined
    const expiresAt = options.ttl !== undefined ? nowInSeconds() + options.ttl : undefined
    const retention = options.ttl !== undefined ? options.ttl + (options.swr ?? 0) : undefined

    await this.storeScript.exec([entryKey, lockKey], [
      token,
      serialized,
      tags !== undefined ? stringifyJSON(tags) : '',
      expiresAt !== undefined ? String(expiresAt) : '',
      retention !== undefined ? String(Math.ceil(retention * 1000)) : '',
      this.tagPrefix,
    ])

    return { output, tags, expiresAt }
  }
}
