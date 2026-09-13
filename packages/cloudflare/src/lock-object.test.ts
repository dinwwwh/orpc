import { promiseWithResolvers, sleep } from '@orpc/shared'
import { evictDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'

describe('durableLockObject', () => {
  function createStub() {
    return env.LOCK_DON.getByName(crypto.randomUUID())
  }

  async function connect(stub: DurableObjectStub, key = 'key') {
    const response = await stub.fetch('https://example.com/acquire', {
      headers: { 'upgrade': 'websocket', 'x-orpc-lock-key': key },
    })

    expect(response.status).toBe(101)

    const socket = response.webSocket!
    const granted = vi.fn()
    const closed = promiseWithResolvers<void>()

    socket.addEventListener('message', () => granted())
    socket.addEventListener('close', () => closed.resolve())
    socket.accept()

    return {
      acquired: response.headers.has('x-orpc-lock-acquired'),
      granted,
      release: async () => {
        socket.close(1000)
        await closed.promise
      },
    }
  }

  /**
   * Connects and leaves right away, resolving with whether the lock was held.
   */
  async function isHeld(stub: DurableObjectStub, key = 'key') {
    const probe = await connect(stub, key)
    await probe.release()

    return !probe.acquired
  }

  it('grants the first socket right away and hands over to parked sockets in order', async () => {
    const stub = createStub()

    const first = await connect(stub)
    expect(first.acquired).toBe(true)

    const second = await connect(stub)
    const third = await connect(stub)

    await sleep(50)
    expect(second.acquired).toBe(false)
    expect(third.acquired).toBe(false)
    expect(second.granted).not.toHaveBeenCalled()
    expect(third.granted).not.toHaveBeenCalled()

    await first.release()
    await vi.waitFor(() => expect(second.granted).toHaveBeenCalled())
    expect(third.granted).not.toHaveBeenCalled()

    await second.release()
    await vi.waitFor(() => expect(third.granted).toHaveBeenCalled())

    await third.release()
    const fourth = await connect(stub)
    expect(fourth.acquired).toBe(true)
  })

  it('skips sockets that left before their turn', async () => {
    const stub = createStub()

    const holder = await connect(stub)
    expect(holder.acquired).toBe(true)

    const first = await connect(stub)
    const second = await connect(stub)
    await first.release()

    await holder.release()
    await vi.waitFor(() => expect(second.granted).toHaveBeenCalled())
  })

  it('keeps the holder and the parked sockets across evictions', async () => {
    const stub = createStub()

    const holder = await connect(stub)
    expect(holder.acquired).toBe(true)
    const waiter = await connect(stub)

    await evictDurableObject(stub)

    expect(await isHeld(stub)).toBe(true)
    expect(waiter.granted).not.toHaveBeenCalled()

    await holder.release()
    await vi.waitFor(() => expect(waiter.granted).toHaveBeenCalled())
  })

  it('serves keys independently within one object', async () => {
    const stub = createStub()

    const alice = await connect(stub, 'alice')
    const bob = await connect(stub, 'bob')
    expect(alice.acquired).toBe(true)
    expect(bob.acquired).toBe(true)

    const aliceWaiter = await connect(stub, 'alice')
    const bobWaiter = await connect(stub, 'bob')
    expect(aliceWaiter.acquired).toBe(false)
    expect(bobWaiter.acquired).toBe(false)

    await alice.release()
    await vi.waitFor(() => expect(aliceWaiter.granted).toHaveBeenCalled())
    expect(bobWaiter.granted).not.toHaveBeenCalled()
    expect(await isHeld(stub, 'bob')).toBe(true)

    await bob.release()
    await vi.waitFor(() => expect(bobWaiter.granted).toHaveBeenCalled())
  })

  it('decodes percent-encoded keys', async () => {
    const stub = createStub()

    const holder = await connect(stub, encodeURIComponent('user@example.com/ü'))
    expect(holder.acquired).toBe(true)
    expect(await isHeld(stub, encodeURIComponent('user@example.com/ü'))).toBe(true)
    expect(await isHeld(stub, encodeURIComponent('user@example.com/u'))).toBe(false)

    await holder.release()
  })

  it('rejects requests without a websocket upgrade or a key', async () => {
    const stub = createStub()

    expect((await stub.fetch('https://example.com/acquire', { headers: { 'x-orpc-lock-key': 'key' } })).status).toBe(400)
    expect((await stub.fetch('https://example.com/acquire', { headers: { upgrade: 'websocket' } })).status).toBe(400)
  })
})
