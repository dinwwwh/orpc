import { DurableObject } from 'cloudflare:workers'

const HOLDER_KEY = 'orpc:lock'

interface LockHolder {
  token: string
  expiresAt: number
}

interface LockWaiter {
  token: string
  ttlMs: number
  seq: number
  granted?: boolean
}

/**
 * Durable Object base class that backs `experimental_DurableLocker`. One object keeps
 * the holder of one lock key in its storage, so the lock survives eviction, and parks
 * waiting callers on hibernatable WebSockets, so the object is not billed while they wait.
 *
 * Durable Objects handle one event at a time and pause incoming events while storage
 * operations are pending, so every check-and-set below is atomic.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLockObject<Env = Cloudflare.Env, Props = unknown> extends DurableObject<Env, Props> {
  private seq: number

  constructor(ctx: DurableObjectState<Props>, env: Env) {
    super(ctx, env)

    // Waiters outlive hibernation, so their ordering continues from the ones still parked.
    this.seq = Math.max(0, ...ctx.getWebSockets().map(ws => (ws.deserializeAttachment() as LockWaiter).seq))
  }

  /**
   * Stores `token` as the holder unless another holder has not expired yet,
   * and resolves with whether the lock was acquired.
   */
  async acquire(token: string, ttlMs: number): Promise<boolean> {
    if (await this.isHeld()) {
      return false
    }

    await this.grant({ token, ttlMs })

    return true
  }

  /**
   * Removes the holder only while it is still `token`, and hands the lock over
   * to the waiter that has been parked the longest, if any.
   */
  async release(token: string): Promise<void> {
    const holder = await this.ctx.storage.get<LockHolder>(HOLDER_KEY)

    if (holder?.token !== token) {
      return
    }

    await this.ctx.storage.delete(HOLDER_KEY)
    await this.handover()
  }

  /**
   * Parks a waiter on a hibernatable WebSocket (`Upgrade: websocket` with the
   * `x-orpc-lock-token` and `x-orpc-lock-ttl` headers) until the lock is handed over to it,
   * which is signaled by a message before the socket is closed.
   */
  override async fetch(request: Request): Promise<Response> {
    const token = request.headers.get('x-orpc-lock-token')
    const ttlMs = Number(request.headers.get('x-orpc-lock-ttl'))

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket' || !token || !(ttlMs > 0)) {
      return new Response('Expected a websocket upgrade with x-orpc-lock-token and x-orpc-lock-ttl headers', { status: 400 })
    }

    const { '0': client, '1': server } = new WebSocketPair()
    server.serializeAttachment({ token, ttlMs, seq: ++this.seq } satisfies LockWaiter)
    this.ctx.acceptWebSocket(server)

    await this.handover()

    return new Response(null, { status: 101, webSocket: client })
  }

  override webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void | Promise<void> {
  }

  override async alarm(): Promise<void> {
    await this.handover()
  }

  /**
   * Grants the lock to the waiter parked the longest, unless it is still held.
   * Clears an expired holder when nobody is waiting.
   */
  private async handover(): Promise<void> {
    if (await this.isHeld()) {
      return
    }

    const waiters = this.ctx.getWebSockets()
      .map(ws => [ws, ws.deserializeAttachment() as LockWaiter] as const)
      .filter(([, waiter]) => !waiter.granted)
      .sort(([, a], [, b]) => a.seq - b.seq)

    for (const [ws, waiter] of waiters) {
      await this.grant(waiter)

      try {
        ws.serializeAttachment({ ...waiter, granted: true } satisfies LockWaiter)
        ws.send('acquired')
      }
      catch {
        continue // the waiter is gone, so hand over to the next one
      }

      ws.close(1000)
      return
    }

    await this.ctx.storage.delete(HOLDER_KEY)
    await this.ctx.storage.deleteAlarm()
  }

  private async isHeld(): Promise<boolean> {
    const holder = await this.ctx.storage.get<LockHolder>(HOLDER_KEY)

    return holder !== undefined && holder.expiresAt > Date.now()
  }

  /**
   * Stores the holder and schedules an alarm at its expiry, so parked waiters
   * are served even when the holder never releases.
   */
  private async grant({ token, ttlMs }: Pick<LockWaiter, 'token' | 'ttlMs'>): Promise<void> {
    const expiresAt = Date.now() + ttlMs

    await this.ctx.storage.put<LockHolder>(HOLDER_KEY, { token, expiresAt })
    await this.ctx.storage.setAlarm(expiresAt)
  }
}
