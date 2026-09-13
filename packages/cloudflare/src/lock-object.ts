import { tryOrUndefined } from '@orpc/shared'
import { DurableObject } from 'cloudflare:workers'

interface LockSocket {
  seq: number
  holder?: boolean
}

/**
 * Durable Object base class that backs `experimental_DurableLocker`. One object serves
 * one lock key, and every caller holds a hibernatable WebSocket while it holds or waits
 * for the lock: the socket is the lock, so closing it releases the lock and the object
 * hands over to the socket that has waited the longest. It keeps no storage and
 * hibernates between events.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLockObject<Env = Cloudflare.Env, Props = unknown> extends DurableObject<Env, Props> {
  private seq: number

  constructor(ctx: DurableObjectState<Props>, env: Env) {
    super(ctx, env)

    this.seq = Math.max(0, ...ctx.getWebSockets().map(ws => attachmentOf(ws).seq))
  }

  /**
   * Acquires the lock over a WebSocket (`Upgrade: websocket`). The `101` response carries
   * the `x-orpc-lock-acquired` header when the lock was free, otherwise the socket receives
   * a message once the lock is handed over to it. Responds with `409` instead of parking
   * the caller when the lock is held and the caller sent no `x-orpc-lock-wait` header.
   */
  override fetch(request: Request): Response {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a websocket upgrade', { status: 400 })
    }

    const held = this.handover()

    if (held && !request.headers.has('x-orpc-lock-wait')) {
      return new Response(null, { status: 409 })
    }

    const { '0': client, '1': server } = new WebSocketPair()
    server.serializeAttachment({ seq: ++this.seq, holder: !held } satisfies LockSocket)
    this.ctx.acceptWebSocket(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: held ? undefined : { 'x-orpc-lock-acquired': 'true' },
    })
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): void {
    try {
      this.handover([ws])
    }
    finally {
      tryOrUndefined(() => ws.close(code, reason))
    }
  }

  override webSocketError(ws: WebSocket, _error: unknown): void {
    this.handover([ws])
  }

  /**
   * Hands the lock over to the socket that has waited the longest unless another
   * socket still holds it, and returns whether the lock is held afterwards.
   */
  private handover(excluded: WebSocket[] = []): boolean {
    let next: { ws: WebSocket, socket: LockSocket } | undefined

    for (const ws of this.ctx.getWebSockets()) {
      if (excluded.includes(ws)) {
        continue
      }

      const socket = attachmentOf(ws)

      if (socket.holder) {
        return true
      }

      if (!next || socket.seq < next.socket.seq) {
        next = { ws, socket }
      }
    }

    if (!next) {
      return false
    }

    try {
      next.ws.send('acquired')
    }
    catch {
      return this.handover([...excluded, next.ws]) // gone, try the next one
    }

    next.ws.serializeAttachment({ ...next.socket, holder: true } satisfies LockSocket)

    return true
  }
}

function attachmentOf(ws: WebSocket): LockSocket {
  return ws.deserializeAttachment() as LockSocket
}
