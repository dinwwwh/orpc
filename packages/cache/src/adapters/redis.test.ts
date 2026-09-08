import { RPCSerializer } from '@orpc/client'
import { nowInSeconds, sleep } from '@orpc/shared'
import { createClient } from 'redis'
import { describeCacheStoreContract } from '../../tests/__shared__/store-contract'
import { RedisCacheStore } from './redis'

const REDIS_URL = process.env.REDIS_URL

describe.concurrent('redis cache store integration', {
  skip: !REDIS_URL,
  timeout: 20_000,
}, async () => {
  const redis = createClient({
    url: REDIS_URL,
  })

  beforeAll(async () => {
    await redis.connect()
  })

  function createTestingStore(
    options: ConstructorParameters<typeof RedisCacheStore>[1] = {},
    client = redis,
  ) {
    const prefix = `orpc-rediscachestore-${crypto.randomUUID()}:`
    return { store: new RedisCacheStore(client, { prefix, ...options }), prefix }
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
    const store = new RedisCacheStore(redis)
    const key = crypto.randomUUID()

    await store.fetch(key, async () => 'v')

    await expect(redis.exists(`e:${key}`)).resolves.toBe(1)
    await expect(store.fetch(key, async () => 'other')).resolves.toMatchObject({ output: 'v' })
  })

  it('treats tags missing from the snapshot as version zero', async () => {
    const { store, prefix } = createTestingStore()

    await redis.hSet(`${prefix}e:k`, { output: JSON.stringify({ body: { json: 'v' } }), tags: '["t"]', tagVersions: '{}' })

    await expect(store.fetch('k', async () => 'other')).resolves.toMatchObject({ output: 'v' })
  })

  it('reloads scripts the server dropped, and rethrows other script errors', async () => {
    const { store, prefix } = createTestingStore()

    await store.fetch('k', async () => 'v')
    await redis.scriptFlush()
    await expect(store.fetch('k', async () => 'other')).resolves.toMatchObject({ output: 'v' })

    await redis.hSet(`${prefix}e:broken`, { output: '{}', tags: 'not json', tagVersions: '{}' })
    await expect(store.fetch('broken', async () => 'v')).rejects.toThrow()
  })

  it('lazily connects a closed client', async () => {
    const lazyRedis = createClient({ url: REDIS_URL })
    const store = new RedisCacheStore(lazyRedis, { prefix: `orpc-redis-cache-store-${crypto.randomUUID()}:` })

    expect(lazyRedis.isOpen).toBe(false)
    await expect(store.fetch('k', async () => 'v')).resolves.toMatchObject({ output: 'v' })
    expect(lazyRedis.isOpen).toBe(true)

    await lazyRedis.destroy()
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
    const waiterStore = new RedisCacheStore(redis, { prefix })
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
