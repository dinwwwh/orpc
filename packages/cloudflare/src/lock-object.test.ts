import { promiseWithResolvers, sleep } from '@orpc/shared'
import { evictDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'

describe('durableLockObject', () => {
  function createStub() {
    return env.LOCK_DON.getByName(crypto.randomUUID())
  }

  async function connect(stub: DurableObjectStub, { wait = true } = {}) {
    const response = await stub.fetch('https://example.com/acquire', {
      headers: {
        upgrade: 'websocket',
        ...(wait ? { 'x-orpc-lock-wait': 'true' } : {}),
      },
    })

    if (response.status !== 101) {
      return { status: response.status }
    }

    const socket = response.webSocket!
    const granted = vi.fn()
    const closed = promiseWithResolvers<void>()

    socket.addEventListener('message', event => granted(JSON.parse(String(event.data))))
    socket.addEventListener('close', () => closed.resolve())
    socket.accept()

    return {
      status: response.status,
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
    await vi.waitFor(() => expect(first.granted).toHaveBeenCalledWith({ waited: false }))

    const second = await connect(stub)
    const third = await connect(stub)

    await sleep(50)
    expect(second.granted).not.toHaveBeenCalled()
    expect(third.granted).not.toHaveBeenCalled()

    await first.release!()
    await vi.waitFor(() => expect(second.granted).toHaveBeenCalledWith({ waited: true }))
    expect(third.granted).not.toHaveBeenCalled()

    await second.release!()
    await vi.waitFor(() => expect(third.granted).toHaveBeenCalledWith({ waited: true }))

    await third.release!()
    const fourth = await connect(stub)
    await vi.waitFor(() => expect(fourth.granted).toHaveBeenCalledWith({ waited: false }))
  })

  it('responds 409 instead of parking when the caller cannot wait', async () => {
    const stub = createStub()

    const holder = await connect(stub)
    await vi.waitFor(() => expect(holder.granted).toHaveBeenCalledWith({ waited: false }))

    expect(await connect(stub, { wait: false })).toEqual({ status: 409 })

    await holder.release!()

    const next = await connect(stub, { wait: false })
    await vi.waitFor(() => expect(next.granted).toHaveBeenCalledWith({ waited: false }))
  })

  it('skips sockets that left before their turn', async () => {
    const stub = createStub()

    const holder = await connect(stub)
    await vi.waitFor(() => expect(holder.granted).toHaveBeenCalledWith({ waited: false }))

    const first = await connect(stub)
    const second = await connect(stub)
    await first.release!()

    await holder.release!()
    await vi.waitFor(() => expect(second.granted).toHaveBeenCalledWith({ waited: true }))
  })

  it('keeps the holder and the parked sockets across evictions', async () => {
    const stub = createStub()

    const holder = await connect(stub)
    await vi.waitFor(() => expect(holder.granted).toHaveBeenCalledWith({ waited: false }))
    const waiter = await connect(stub)

    await evictDurableObject(stub)

    expect(await connect(stub, { wait: false })).toEqual({ status: 409 })
    expect(waiter.granted).not.toHaveBeenCalled()

    await holder.release!()
    await vi.waitFor(() => expect(waiter.granted).toHaveBeenCalledWith({ waited: true }))
  })

  it('rejects requests that are not a websocket upgrade', async () => {
    const stub = createStub()

    expect((await stub.fetch('https://example.com/acquire')).status).toBe(400)
  })
})
