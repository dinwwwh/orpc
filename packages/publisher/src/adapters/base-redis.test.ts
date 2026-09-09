import type { BaseRedisPublisherOptions, RedisStreamEntry } from './base-redis'
import { promiseWithResolvers } from '@orpc/shared'
import { getEventMeta, withEventMeta } from '@standard-server/core'
import { BaseRedisPublisher } from './base-redis'

class FakeRedis {
  readonly channels = new Map<string, Set<(message: string) => void>>()
  readonly streams = new Map<string, RedisStreamEntry[]>()
  private lastId = 0

  publish(channel: string, message: string): void {
    this.channels.get(channel)?.forEach(listener => listener(message))
  }

  subscribe(channel: string, listener: (message: string) => void): () => void {
    const listeners = this.channels.get(channel) ?? new Set()
    this.channels.set(channel, listeners.add(listener))

    return () => {
      listeners.delete(listener)

      if (listeners.size === 0) {
        this.channels.delete(channel)
      }
    }
  }

  xadd(key: string, data: string): string {
    const entry = { id: `${++this.lastId}-0`, data }
    this.streams.set(key, [...this.streams.get(key) ?? [], entry])
    return entry.id
  }

  xread(key: string, lastId: string): RedisStreamEntry[] {
    return this.streams.get(key)?.filter(entry => Number.parseInt(entry.id) > Number.parseInt(lastId)) ?? []
  }
}

class FakeRedisPublisher<T extends Record<string, object> = Record<string, object>> extends BaseRedisPublisher<T> {
  constructor(private readonly redis: FakeRedis, options?: BaseRedisPublisherOptions) {
    super(options)
  }

  protected async publishMessage(channel: string, message: string): Promise<void> {
    this.redis.publish(channel, message)
  }

  protected async subscribeChannel(channel: string, listener: (message: unknown) => void): Promise<() => Promise<void>> {
    const unsubscribe = this.redis.subscribe(channel, listener)
    return async () => unsubscribe()
  }

  protected async addStreamEntry(key: string, data: string): Promise<string> {
    return this.redis.xadd(key, data)
  }

  protected async readStreamEntries(key: string, lastId: string): Promise<RedisStreamEntry[]> {
    return this.redis.xread(key, lastId)
  }
}

describe('baseRedisPublisher', () => {
  let redis: FakeRedis

  beforeEach(() => {
    redis = new FakeRedis()
  })

  it('delivers live events between publishers sharing a server and prefix', async () => {
    const source = new FakeRedisPublisher(redis, { prefix: 'app:' })
    const target = new FakeRedisPublisher(redis, { prefix: 'app:' })
    const other = new FakeRedisPublisher(redis, { prefix: 'other:' })
    const listener = vi.fn()
    const otherListener = vi.fn()

    const unsubscribe = await target.subscribe('orders', listener)
    const unsubscribeOther = await other.subscribe('orders', otherListener)
    await source.publish('orders', { order: 1 })
    await source.publish('orders', withEventMeta({ order: 2 }, { id: 'custom', comments: ['audit'] }))

    expect([...redis.channels.keys()]).toEqual(['app:orders', 'other:orders'])
    expect(listener.mock.calls.map(call => call[0])).toEqual([{ order: 1 }, { order: 2 }])
    expect(getEventMeta(listener.mock.calls[0]![0])).toBeUndefined()
    expect(getEventMeta(listener.mock.calls[1]![0])).toEqual({ id: 'custom', comments: ['audit'] })
    expect(otherListener).not.toHaveBeenCalled()

    await unsubscribe()
    await unsubscribeOther()

    expect(redis.channels.size).toBe(0)
  })

  it('uses a stable wire format for stream entries and messages', async () => {
    const publisher = new FakeRedisPublisher(redis, { resume: { enabled: true } })
    const messages: string[] = []
    redis.subscribe('orders', message => messages.push(message))

    await publisher.publish('orders', withEventMeta({ order: 1, at: new Date('2024-01-01') }, { comments: ['audit'] }))

    const [entry] = redis.streams.get('orders')!
    expect(entry!.data).toBe('{"payload":{"json":{"order":1,"at":"2024-01-01T00:00:00.000Z"},"meta":[["date","at"]]},"meta":{"comments":["audit"]}}')
    expect(messages).toEqual([`{"data":${entry!.data},"id":"${entry!.id}"}`])
  })

  it('skips streams when resume is disabled', async () => {
    const publisher = new FakeRedisPublisher(redis)
    const addStreamEntry = vi.spyOn(publisher as any, 'addStreamEntry')
    const readStreamEntries = vi.spyOn(publisher as any, 'readStreamEntries')
    const listener = vi.fn()

    const unsubscribe = await publisher.subscribe('orders', listener, { lastEventId: '0' })
    await publisher.publish('orders', { order: 1 })

    expect(listener).toHaveBeenCalledExactlyOnceWith({ order: 1 })
    expect(getEventMeta(listener.mock.calls[0]![0])).toBeUndefined()
    expect(addStreamEntry).not.toHaveBeenCalled()
    expect(readStreamEntries).not.toHaveBeenCalled()

    await unsubscribe()
  })

  it('trims once per resume window per channel', async ({ onTestFinished }) => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    onTestFinished(() => now.mockRestore())
    const publisher = new FakeRedisPublisher(redis, { prefix: 'app:', resume: { enabled: true, seconds: 10 } })
    ;(publisher as any).xTrimExactness = '='
    const addStreamEntry = vi.spyOn(publisher as any, 'addStreamEntry')

    await publisher.publish('orders', { order: 1 })
    await publisher.publish('orders', { order: 2 })
    await publisher.publish('invoices', { invoice: 1 })
    now.mockReturnValue(1_010_001)
    await publisher.publish('orders', { order: 3 })

    expect(addStreamEntry.mock.calls.map(([key, , trim]) => [key, trim])).toEqual([
      ['app:orders', { minId: '990000-0', exactness: '=', expireSeconds: 20 }],
      ['app:orders', undefined],
      ['app:invoices', { minId: '990000-0', exactness: '=', expireSeconds: 20 }],
      ['app:orders', { minId: '1000001-0', exactness: '=', expireSeconds: 20 }],
    ])
  })

  it('resumes missed events and deduplicates those that also arrive live', async () => {
    const publisher = new FakeRedisPublisher(redis, { resume: { enabled: true } })
    const liveListener = vi.fn()
    const unsubscribeLive = await publisher.subscribe('orders', liveListener)
    await publisher.publish('orders', { order: 1 })
    await publisher.publish('orders', { order: 2 })
    await unsubscribeLive()

    const resumeGate = promiseWithResolvers<void>()
    vi.spyOn(publisher as any, 'readStreamEntries').mockImplementationOnce(async (key: any, lastId: any) => {
      await resumeGate.promise
      return redis.xread(key, lastId)
    })
    const listener = vi.fn()

    const [unsubscribe] = await Promise.all([
      publisher.subscribe('orders', listener, { lastEventId: getEventMeta(liveListener.mock.calls[0]![0])?.id }),
      publisher.publish('orders', { order: 3 })
        .then(() => publisher.publish('orders', { order: 4 }))
        .then(() => resumeGate.resolve()),
    ])
    await publisher.publish('orders', { order: 5 })

    expect(listener.mock.calls.map(call => call[0].order)).toEqual([2, 3, 4, 5])
    expect(listener.mock.calls.map(call => getEventMeta(call[0])?.id)).toEqual(redis.streams.get('orders')!.slice(1).map(entry => entry.id))

    await unsubscribe()
  })

  it('routes onError to the channel subscription and reports malformed messages through it', async () => {
    const publisher = new FakeRedisPublisher(redis)
    const subscribeChannel = vi.spyOn(publisher as any, 'subscribeChannel')
    const listener = vi.fn()
    const onError = vi.fn()

    const unsubscribe = await publisher.subscribe('orders', listener, { onError })
    redis.publish('orders', 'invalid')

    expect(subscribeChannel).toHaveBeenCalledWith('orders', expect.any(Function), onError)
    expect(listener).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(SyntaxError))

    await unsubscribe()
  })

  it('releases the subscription when resuming fails', async () => {
    const publisher = new FakeRedisPublisher(redis, { resume: { enabled: true } })
    vi.spyOn(publisher as any, 'readStreamEntries').mockRejectedValueOnce(new Error('XREAD failed'))

    await expect(publisher.subscribe('orders', vi.fn(), { lastEventId: '0' })).rejects.toThrow('XREAD failed')

    expect(redis.channels.size).toBe(0)
  })

  it('propagates subscription failures', async () => {
    const publisher = new FakeRedisPublisher(redis, { resume: { enabled: true } })
    vi.spyOn(publisher as any, 'subscribeChannel').mockRejectedValueOnce(new Error('SUBSCRIBE failed'))

    await expect(publisher.subscribe('orders', vi.fn(), { lastEventId: '0' })).rejects.toThrow('SUBSCRIBE failed')
  })

  it('makes the unsubscribe handle idempotent', async () => {
    const publisher = new FakeRedisPublisher(redis)
    const unsubscribeChannel = vi.fn(async () => {})
    vi.spyOn(publisher as any, 'subscribeChannel').mockResolvedValueOnce(unsubscribeChannel)

    const unsubscribe = await publisher.subscribe('orders', vi.fn())
    await Promise.all([unsubscribe(), unsubscribe(), unsubscribe()])

    expect(unsubscribeChannel).toHaveBeenCalledTimes(1)
  })

  it('accepts messages and stream entries already parsed by the client', async () => {
    const publisher = new FakeRedisPublisher(redis, { resume: { enabled: true } })
    let deliver!: (message: unknown) => void
    vi.spyOn(publisher as any, 'subscribeChannel').mockImplementationOnce(async (_channel: any, listener: any) => {
      deliver = listener
      return async () => {}
    })
    vi.spyOn(publisher as any, 'readStreamEntries').mockResolvedValueOnce([{ id: '1-0', data: { payload: { json: { order: 1 } } } }])
    const listener = vi.fn()

    const unsubscribe = await publisher.subscribe('orders', listener, { lastEventId: '0' })
    deliver({ id: '2-0', data: { payload: { json: { order: 2 } }, meta: { comments: ['audit'] } } })

    expect(listener.mock.calls.map(call => call[0])).toEqual([{ order: 1 }, { order: 2 }])
    expect(getEventMeta(listener.mock.calls[0]![0])).toEqual({ id: '1-0' })
    expect(getEventMeta(listener.mock.calls[1]![0])).toEqual({ id: '2-0', comments: ['audit'] })

    await unsubscribe()
  })
})
