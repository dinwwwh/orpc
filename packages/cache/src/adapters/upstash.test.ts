import { RPCSerializer } from '@orpc/client'
import { nowInSeconds, sleep } from '@orpc/shared'
import { Redis } from '@upstash/redis'
import { describeCacheStoreContract } from '../../tests/__shared__/store-contract'
import { UpstashCacheStore } from './upstash'

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

/**
 * These tests depend on a real Upstash redis server — make sure to set the
 * `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` envs.
 */
describe.concurrent('upstash cache store integration', {
  // TODO: Upstash is not compatible with Node 26 yet — temporarily disable these tests and revisit in the future.
  skip: !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || process.versions.node.startsWith('26.'),
  timeout: 20_000,
}, () => {
  const redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  })

  function createTestingStore(
    options: ConstructorParameters<typeof UpstashCacheStore>[1] = {},
    client = redis,
  ) {
    const prefix = `orpc-upstashcachestore-${crypto.randomUUID()}:`
    return { store: new UpstashCacheStore(client, { prefix, ...options }), prefix }
  }

  describeCacheStoreContract(() => createTestingStore().store)

  it('supports a custom serializer', async () => {
    const serializer = new RPCSerializer()
    const serializeSpy = vi.spyOn(serializer, 'serialize')
    const deserializeSpy = vi.spyOn(serializer, 'deserialize')
    const { store } = createTestingStore({ serializer })

    await store.fetch('k', async () => ({ a: 1 }))

    await expect(store.fetch('k', async () => 'other')).resolves.toMatchObject({ output: { a: 1 } })
    expect(serializeSpy).toHaveBeenCalled()
    expect(deserializeSpy).toHaveBeenCalled()
  })

  it('fills again at ttl without swr, and serves stale within the swr window while refreshing', async () => {
    const { store } = createTestingStore()

    await store.fetch('no-swr', async () => 'v', { ttl: 1 })
    await store.fetch('swr', async () => 'v', { ttl: 1, swr: 10 })

    await sleep(1500)

    await expect(store.fetch('no-swr', async () => 'refilled', { ttl: 1 })).resolves.toMatchObject({ output: 'refilled' })

    const waitUntil = vi.fn()
    const stale = await store.fetch('swr', async () => 'fresh', { ttl: 1, swr: 10, waitUntil })
    expect(stale.output).toBe('v')
    expect(stale.expiresAt).toBeLessThanOrEqual(nowInSeconds())

    expect(waitUntil).toHaveBeenCalledTimes(1)
    await waitUntil.mock.calls[0]![0]

    const fresh = await store.fetch('swr', async () => 'other', { ttl: 1, swr: 10 })
    expect(fresh.output).toBe('fresh')
    expect(fresh.expiresAt).toBeGreaterThan(stale.expiresAt!)
  })

  it('stores entries as hashes and tag counters under the prefixed key families, locking while filling', async () => {
    const { store, prefix } = createTestingStore()

    await store.fetch('k', async () => {
      await expect(redis.exists(`${prefix}l:k`)).resolves.toBe(1)
      return 'v'
    }, { tags: ['t'] })
    await store.revalidate({ tags: ['t'] })

    await expect(redis.type(`${prefix}e:k`)).resolves.toBe('hash')
    await expect(redis.exists(`${prefix}t:t`)).resolves.toBe(1)
    await expect(redis.exists(`${prefix}l:k`)).resolves.toBe(0)
  })

  it('defaults to no prefix', async () => {
    const store = new UpstashCacheStore(redis)
    const key = crypto.randomUUID()

    await store.fetch(key, async () => 'v')

    await expect(redis.exists(`e:${key}`)).resolves.toBe(1)
    await expect(store.fetch(key, async () => 'other')).resolves.toMatchObject({ output: 'v' })
  })

  it('treats tags missing from the snapshot as version zero', async () => {
    const { store, prefix } = createTestingStore()

    await redis.hset(`${prefix}e:k`, { output: JSON.stringify({ body: { json: 'v' } }), tags: '["t"]', tagVersions: '{}' })

    await expect(store.fetch('k', async () => 'other')).resolves.toMatchObject({ output: 'v' })
  })

  it('reloads scripts the server dropped, and rethrows other script errors', async () => {
    const { store, prefix } = createTestingStore()

    await store.fetch('k', async () => 'v')
    await redis.scriptFlush()
    await expect(store.fetch('k', async () => 'other')).resolves.toMatchObject({ output: 'v' })

    await redis.hset(`${prefix}e:broken`, { output: '{}', tags: 'not json', tagVersions: '{}' })
    await expect(store.fetch('broken', async () => 'v')).rejects.toThrow()
  })

  it('reads entries when the client does not parse JSON replies', async () => {
    const rawRedis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: false,
    })
    const { store } = createTestingStore({}, rawRedis)

    await store.fetch('k', async () => ({ a: 1 }), { tags: ['t'], ttl: 60 })

    const entry = await store.fetch('k', async () => 'other', { tags: ['t'], ttl: 60 })
    expect(entry.output).toEqual({ a: 1 })
    expect(entry.tags).toEqual(['t'])
    expect(entry.expiresAt).toBeGreaterThan(nowInSeconds())

    await store.revalidate({ tags: ['t'] })
    await expect(store.fetch('k', async () => 'refilled', { tags: ['t'] })).resolves.toMatchObject({ output: 'refilled' })
  })

  it('stays consistent under concurrent fetches and a revalidation on a shared tag', async () => {
    const { store } = createTestingStore()
    const keys = Array.from({ length: 20 }, (_, index) => `k${index}`)

    await Promise.all([
      ...keys.map(key => store.fetch(key, async () => key, { tags: ['t'] })),
      store.revalidate({ tags: ['t'] }),
    ])

    const entries = await Promise.all(keys.map(key => store.fetch(key, async () => key, { tags: ['t'] })))
    expect(entries.map(entry => entry.output)).toEqual(keys)
  })

  it('frees waiters after lockTtl and leaves a lock taken over that way alone', async () => {
    const { store: holderStore, prefix } = createTestingStore({ lockTtl: 1 })
    const waiterStore = new UpstashCacheStore(redis, { prefix })
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let takenOver!: () => void
    const takeover = new Promise<void>((resolve) => {
      takenOver = resolve
    })

    const holder = holderStore.fetch('k', async () => {
      await takeover
      return 'holder'
    })
    await vi.waitFor(() => expect(redis.exists(`${prefix}l:k`)).resolves.toBe(1), { timeout: 5000 })

    const waiter = waiterStore.fetch('k', async () => {
      takenOver()
      await held
      return 'waiter'
    })

    await expect(holder).resolves.toMatchObject({ output: 'holder' })
    await expect(redis.exists(`${prefix}l:k`)).resolves.toBe(1)

    release()
    await expect(waiter).resolves.toMatchObject({ output: 'waiter' })
    await expect(redis.exists(`${prefix}l:k`)).resolves.toBe(0)
    await expect(holderStore.fetch('k', async () => 'other')).resolves.toMatchObject({ output: 'waiter' })
  })
})
