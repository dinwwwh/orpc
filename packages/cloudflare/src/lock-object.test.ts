import { promiseWithResolvers, sleep } from '@orpc/shared'
import { evictDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'

describe('durableLockObject', () => {
  function createStub() {
    return env.LOCK_DON.getByName(crypto.randomUUID())
  }

  /**
   * Tries to acquire without waiting, and resolves with the response status.
   */
  async function tryAcquire(stub: DurableObjectStub) {
    const response = await stub.fetch('https://example.com/acquire', {
      headers: { upgrade: 'websocket' },
    })

    return response.status
  }

  async function connect(stub: DurableObjectStub) {
    const response = await stub.fetch('https://example.com/acquire', {
      headers: {
        'upgrade': 'websocket',
        'x-orpc-lock-wait': 'true',
      },
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

  it('responds 409 instead of parking when the caller cannot wait', async () => {
    const stub = createStub()

    const holder = await connect(stub)
    expect(holder.acquired).toBe(true)

    expect(await tryAcquire(stub)).toBe(409)

    await holder.release()

    const next = await connect(stub)
    expect(next.acquired).toBe(true)
    await next.release()
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

    expect(await tryAcquire(stub)).toBe(409)
    expect(waiter.granted).not.toHaveBeenCalled()

    await holder.release()
    await vi.waitFor(() => expect(waiter.granted).toHaveBeenCalled())
  })

  it('rejects requests that are not a websocket upgrade', async () => {
    const stub = createStub()

    expect((await stub.fetch('https://example.com/acquire')).status).toBe(400)
  })
})
