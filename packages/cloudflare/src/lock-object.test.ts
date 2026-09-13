import type { LockDO } from '../tests/__shared__/main'
import { sleep } from '@orpc/shared'
import { evictDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('durableLockObject', () => {
  function createStub() {
    return env.LOCK_DON.getByName(crypto.randomUUID()) as DurableObjectStub<LockDO>
  }

  it('acquires only when free, and releases only for the holder', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 10_000)).toBe(true)
    expect(await stub.acquire('b', 10_000)).toBe(false)

    await stub.release('b')
    expect(await stub.acquire('b', 10_000)).toBe(false)

    await stub.release('a')
    expect(await stub.acquire('b', 10_000)).toBe(true)
  })

  it('lets a new holder acquire an expired lock, which the old holder can no longer release', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 50)).toBe(true)
    await sleep(60)
    expect(await stub.acquire('b', 10_000)).toBe(true)

    await stub.release('a')
    expect(await stub.acquire('c', 10_000)).toBe(false)

    await stub.release('b')
    expect(await stub.acquire('c', 10_000)).toBe(true)
  })

  it('keeps the holder across evictions', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 10_000)).toBe(true)
    await evictDurableObject(stub)
    expect(await stub.acquire('b', 10_000)).toBe(false)

    await stub.release('a')
    expect(await stub.acquire('b', 10_000)).toBe(true)
  })
})
