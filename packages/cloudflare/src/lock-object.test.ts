import type { LockDO } from '../tests/__shared__/main'
import { promiseWithResolvers, sleep } from '@orpc/shared'
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('durableLockObject', () => {
  function createStub() {
    return env.LOCK_DON.getByName(crypto.randomUUID()) as DurableObjectStub<LockDO>
  }

  function acquire(stub: DurableObjectStub<LockDO>, token: string, ttlMs = 10_000) {
    return stub.fetch('https://example.com/acquire', {
      headers: {
        'x-orpc-lock-token': token,
        'x-orpc-lock-ttl': String(ttlMs),
      },
    })
  }

  function release(stub: DurableObjectStub<LockDO>, token: string) {
    return stub.release(token)
  }

  async function park(stub: DurableObjectStub<LockDO>, token: string, ttlMs = 10_000) {
    const response = await stub.fetch('https://example.com/acquire', {
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

    expect((await acquire(stub, 'a')).status).toBe(204)
    expect((await acquire(stub, 'b')).status).toBe(409)

    await release(stub, 'b')
    expect((await acquire(stub, 'b')).status).toBe(409)

    await release(stub, 'a')
    expect((await acquire(stub, 'b')).status).toBe(204)
  })

  it('lets a new holder acquire an expired lock, which the old holder can no longer release', async () => {
    const stub = createStub()

    expect((await acquire(stub, 'a', 50)).status).toBe(204)
    await sleep(60)
    expect((await acquire(stub, 'b')).status).toBe(204)

    await release(stub, 'a')
    expect((await acquire(stub, 'c')).status).toBe(409)

    await release(stub, 'b')
    expect((await acquire(stub, 'c')).status).toBe(204)
  })

  it('keeps the holder across evictions', async () => {
    const stub = createStub()

    expect((await acquire(stub, 'a')).status).toBe(204)
    await evictDurableObject(stub)
    expect((await acquire(stub, 'b')).status).toBe(409)

    await release(stub, 'a')
    expect((await acquire(stub, 'b')).status).toBe(204)
  })

  it('schedules an alarm at the holder expiry, and clears it once released', async () => {
    const stub = createStub()
    const before = Date.now()

    expect((await acquire(stub, 'a')).status).toBe(204)

    const alarm = await getAlarm(stub)
    expect(alarm).toBeGreaterThanOrEqual(before + 10_000)
    expect(alarm).toBeLessThanOrEqual(Date.now() + 10_000)

    await release(stub, 'a')
    expect(await getAlarm(stub)).toBeNull()
  })

  it('acquires right away without upgrading when the lock is free', async () => {
    const stub = createStub()

    const response = await stub.fetch('https://example.com/acquire', {
      headers: {
        'upgrade': 'websocket',
        'x-orpc-lock-token': 'a',
        'x-orpc-lock-ttl': '10000',
      },
    })

    expect(response.status).toBe(204)
    expect(response.webSocket).toBeNull()
    expect((await acquire(stub, 'b')).status).toBe(409)
  })

  it('hands the lock over to parked waiters in order', async () => {
    const stub = createStub()

    expect((await acquire(stub, 'a')).status).toBe(204)

    const first = await park(stub, 'b')
    const second = await park(stub, 'c')

    await sleep(50)
    expect((await acquire(stub, 'd')).status).toBe(409)

    await release(stub, 'a')
    await expect(first.acquired).resolves.toBe('acquired')
    expect((await acquire(stub, 'd')).status).toBe(409)

    await release(stub, 'b')
    await expect(second.acquired).resolves.toBe('acquired')
    expect((await acquire(stub, 'd')).status).toBe(409)

    await release(stub, 'c')
    expect((await acquire(stub, 'd')).status).toBe(204)
  })

  it('hands the lock over when the holder expires', async () => {
    const stub = createStub()

    expect((await acquire(stub, 'a', 50)).status).toBe(204)
    const { acquired } = await park(stub, 'b')

    await sleep(60)
    expect(await runDurableObjectAlarm(stub)).toBe(true)

    await expect(acquired).resolves.toBe('acquired')
    await release(stub, 'a')
    expect((await acquire(stub, 'c')).status).toBe(409)
  })

  it('skips waiters that left before their turn', async () => {
    const stub = createStub()

    expect((await acquire(stub, 'a')).status).toBe(204)

    const first = await park(stub, 'b')
    const second = await park(stub, 'c')
    first.socket.close()
    await sleep(50)

    await release(stub, 'a')
    await expect(second.acquired).resolves.toBe('acquired')
  })

  it('keeps parked waiters across evictions', async () => {
    const stub = createStub()

    expect((await acquire(stub, 'a')).status).toBe(204)
    const { acquired } = await park(stub, 'b')

    await evictDurableObject(stub)
    await release(stub, 'a')

    await expect(acquired).resolves.toBe('acquired')
  })

  it('rejects requests without the lock headers', async () => {
    const stub = createStub()

    expect((await stub.fetch('https://example.com/acquire')).status).toBe(400)

    const missingTtl = await stub.fetch('https://example.com/acquire', {
      headers: { 'x-orpc-lock-token': 'a' },
    })
    expect(missingTtl.status).toBe(400)
  })
})
