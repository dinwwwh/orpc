import type { LockDO } from '../tests/__shared__/main'
import { promiseWithResolvers, sleep } from '@orpc/shared'
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('durableLockObject', () => {
  function createStub() {
    return env.LOCK_DON.getByName(crypto.randomUUID()) as DurableObjectStub<LockDO>
  }

  async function park(stub: DurableObjectStub<LockDO>, token: string, ttlMs = 10_000) {
    const response = await stub.fetch('https://example.com/wait', {
      headers: {
        'upgrade': 'websocket',
        'x-orpc-lock-token': token,
        'x-orpc-lock-ttl': String(ttlMs),
      },
    })

    expect(response.status).toBe(101)

    const socket = response.webSocket!
    const { promise: acquired, resolve } = promiseWithResolvers<string>()
    socket.addEventListener('message', event => resolve(String(event.data)))
    socket.accept()

    return { socket, acquired }
  }

  function getAlarm(stub: DurableObjectStub<LockDO>) {
    return runInDurableObject(stub, async (_, state) => state.storage.getAlarm())
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

  it('schedules an alarm at the holder expiry, and clears it once released', async () => {
    const stub = createStub()
    const before = Date.now()

    expect(await stub.acquire('a', 10_000)).toBe(true)

    const alarm = await getAlarm(stub)
    expect(alarm).toBeGreaterThanOrEqual(before + 10_000)
    expect(alarm).toBeLessThanOrEqual(Date.now() + 10_000)

    await stub.release('a')
    expect(await getAlarm(stub)).toBeNull()
  })

  it('hands the lock over to parked waiters in order', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 10_000)).toBe(true)

    const first = await park(stub, 'b')
    const second = await park(stub, 'c')

    await sleep(50)
    expect(await stub.acquire('d', 10_000)).toBe(false)

    await stub.release('a')
    await expect(first.acquired).resolves.toBe('acquired')
    expect(await stub.acquire('d', 10_000)).toBe(false)

    await stub.release('b')
    await expect(second.acquired).resolves.toBe('acquired')
    expect(await stub.acquire('d', 10_000)).toBe(false)

    await stub.release('c')
    expect(await stub.acquire('d', 10_000)).toBe(true)
  })

  it('grants a waiter immediately when the lock is free', async () => {
    const stub = createStub()

    const { acquired } = await park(stub, 'a')

    await expect(acquired).resolves.toBe('acquired')
    expect(await stub.acquire('b', 10_000)).toBe(false)
  })

  it('hands the lock over when the holder expires', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 50)).toBe(true)
    const { acquired } = await park(stub, 'b')

    await sleep(60)
    expect(await runDurableObjectAlarm(stub)).toBe(true)

    await expect(acquired).resolves.toBe('acquired')
    await stub.release('a')
    expect(await stub.acquire('c', 10_000)).toBe(false)
  })

  it('skips waiters that left before their turn', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 10_000)).toBe(true)

    const first = await park(stub, 'b')
    const second = await park(stub, 'c')
    first.socket.close()
    await sleep(50)

    await stub.release('a')
    await expect(second.acquired).resolves.toBe('acquired')
  })

  it('keeps parked waiters across evictions', async () => {
    const stub = createStub()

    expect(await stub.acquire('a', 10_000)).toBe(true)
    const { acquired } = await park(stub, 'b')

    await evictDurableObject(stub)
    await stub.release('a')

    await expect(acquired).resolves.toBe('acquired')
  })

  it('rejects requests that are not a websocket upgrade with the lock headers', async () => {
    const stub = createStub()

    const response = await stub.fetch('https://example.com/wait')
    expect(response.status).toBe(400)

    const missingTtl = await stub.fetch('https://example.com/wait', {
      headers: { 'upgrade': 'websocket', 'x-orpc-lock-token': 'a' },
    })
    expect(missingTtl.status).toBe(400)
  })
})
