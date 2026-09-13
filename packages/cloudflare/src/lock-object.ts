import { stringifyJSON, tryOrUndefined } from '@orpc/shared'
import { DurableObject } from 'cloudflare:workers'

interface LockSocket {
  seq: number
  holder?: boolean
}

/**
 * Durable Object base class that backs `experimental_DurableLocker`. One object serves
 * one lock key, and every caller holds a hibernatable WebSocket while it holds or waits
 * for the lock: the socket is the lock, so closing it releases the lock and the object
 * hands over to the socket that has waited the longest. It keeps no storage and hibernates
 * between events, so it is not billed while callers hold or wait for the lock.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLockObject<Env = Cloudflare.Env, Props = unknown> extends DurableObject<Env, Props> {
  private seq: number

  constructor(ctx: DurableObjectState<Props>, env: Env) {
    super(ctx, env)

    // Sockets outlive hibernation, so their ordering continues from the ones still connected.
    this.seq = Math.max(0, ...ctx.getWebSockets().map(ws => attachmentOf(ws).seq))
  }

  /**
   * Acquires the lock over a WebSocket (`Upgrade: websocket`). The caller receives
   * `{ waited }` once it holds the lock, right away or after the previous holder's
   * socket closes. Responds with `409` instead of parking the caller when the lock
   * is held and the caller sent no `x-orpc-lock-wait` header.
   */
  override fetch(request: Request): Response {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a websocket upgrade', { status: 400 })
    }

    if (!request.headers.get('x-orpc-lock-wait') && this.ctx.getWebSockets().some(ws => attachmentOf(ws).holder)) {
      return new Response(null, { status: 409 })
    }

    const { '0': client, '1': server } = new WebSocketPair()
    server.serializeAttachment({ seq: ++this.seq } satisfies LockSocket)
    this.ctx.acceptWebSocket(server)

    this.handover({ connecting: server })

    return new Response(null, { status: 101, webSocket: client })
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): void {
    this.handover({ closing: ws })
    tryOrUndefined(() => ws.close(code, reason)) // completes the closing handshake
  }

  override webSocketError(ws: WebSocket, _error: unknown): void {
    this.handover({ closing: ws })
  }

  /**
   * Hands the lock over to the socket that has waited the longest,
   * unless another open socket still holds it.
   */
  private handover({ connecting, closing }: { connecting?: WebSocket, closing?: WebSocket }): void {
    const sockets = this.ctx.getWebSockets()
      .filter(ws => ws !== closing)
      .map(ws => [ws, attachmentOf(ws)] as const)

    if (sockets.some(([, socket]) => socket.holder)) {
      return
    }

    for (const [ws, socket] of sockets.sort(([, a], [, b]) => a.seq - b.seq)) {
      try {
        ws.serializeAttachment({ ...socket, holder: true } satisfies LockSocket)
        ws.send(stringifyJSON({ waited: ws !== connecting }))
        return
      }
      catch {
        continue // the caller is gone, so hand over to the next one
      }
    }
  }
}

function attachmentOf(ws: WebSocket): LockSocket {
  return ws.deserializeAttachment() as LockSocket
}
