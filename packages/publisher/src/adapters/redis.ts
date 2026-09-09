import type { RedisClientType } from 'redis'
import type { BaseRedisPublisherOptions, RedisStreamEntry, RedisStreamTrimOptions } from './base-redis'
import { BaseRedisPublisher } from './base-redis'

export interface RedisPublisherOptions extends BaseRedisPublisherOptions {
  /**
   * Redis subscriber instance.
   * Pub/Sub takes over the connection, so a client with subscriptions
   * cannot execute commands and must use a dedicated connection.
   *
   * @default redis.duplicate()
   */
  subscriber?: undefined | RedisClientType<any, any, any, any, any>
}

/**
 * Publisher adapter for Redis. Distributes events across processes via
 * Redis Pub/Sub, with optional resume support backed by Redis Streams.
 *
 * @see {@link https://orpc.dev/docs/helpers/publisher#adapters | Publisher Helpers - Adapters}
 */
export class RedisPublisher<T extends Record<string, object>> extends BaseRedisPublisher<T> {
  private readonly subscriber: Exclude<RedisPublisherOptions['subscriber'], undefined>

  constructor(
    private readonly redis: RedisClientType<any, any, any, any, any>,
    { subscriber, ...options }: RedisPublisherOptions = {},
  ) {
    super(options)

    this.subscriber = subscriber ?? redis.duplicate()
  }

  protected async publishMessage(channel: string, message: string): Promise<void> {
    await connectIfNeeded(this.redis)
    await this.redis.publish(channel, message)
  }

  protected async subscribeChannel(channel: string, listener: (message: unknown) => void): Promise<() => Promise<void>> {
    await connectIfNeeded(this.subscriber)
    await this.subscriber.subscribe(channel, listener)

    return async () => {
      await this.subscriber.unsubscribe(channel, listener)
    }
  }

  protected async addStreamEntry(key: string, data: string, trim?: RedisStreamTrimOptions): Promise<string> {
    await connectIfNeeded(this.redis)

    if (!trim) {
      return await this.redis.xAdd(key, '*', { data }) as string
    }

    const [id] = await this.redis.multi()
      .xAdd(key, '*', { data })
      .xTrim(key, 'MINID', trim.minId, { strategyModifier: trim.exactness })
      .expire(key, trim.expireSeconds)
      .exec()

    return id as unknown as string
  }

  protected async readStreamEntries(key: string, lastId: string): Promise<RedisStreamEntry[]> {
    await connectIfNeeded(this.redis)

    const results = await this.redis.xRead({ key, id: lastId })

    const entries: Array<{ id: string, message: Record<string, string> }> = results?.[0]?.messages ?? []

    return entries.map(({ id, message }) => ({ id, data: message.data! }))
  }
}

async function connectIfNeeded(client: RedisClientType<any, any, any, any, any>): Promise<void> {
  if (!client.isOpen) {
    await client.connect()
  }
}
