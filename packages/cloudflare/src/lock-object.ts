import { tryOrUndefined } from '@orpc/shared'
import { DurableObject } from 'cloudflare:workers'

interface LockSocket {
  seq: number
  holder?: boolean
}

/**
 * Durable Object base class that backs `experimental_DurableLocker`. It keeps no storage:
 * every caller holds a hibernatable WebSocket while it holds or waits for the lock,
 * so closing the socket releases the lock.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLockObject<Env = Cloudflare.Env, Props = unknown> extends DurableObject<Env, Props> {
  private seq = 0

  constructor(ctx: DurableObjectState<Props>, env: Env) {
    super(ctx, env)

    for (const ws of ctx.getWebSockets()) {
      this.seq = Math.max(this.seq, attachmentOf(ws).seq)
    }
  }

  override fetch(request: Request): Response {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a websocket upgrade', { status: 400 })
    }

    const held = this.handover()
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
      return this.handover([...excluded, next.ws])
    }

    next.ws.serializeAttachment({ ...next.socket, holder: true } satisfies LockSocket)

    return true
  }
}

function attachmentOf(ws: WebSocket): LockSocket {
  return ws.deserializeAttachment() as LockSocket
}
