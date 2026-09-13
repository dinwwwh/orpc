import { DurableObject } from 'cloudflare:workers'

/**
 * Durable Object base class that backs `experimental_DurableLocker`. It keeps no storage:
 * every caller holds a hibernatable WebSocket while it holds or waits for the lock,
 * so closing the socket releases the lock.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLockObject<Env = Cloudflare.Env, Props = unknown> extends DurableObject<Env, Props> {
  override fetch(): Response {
    const held = this.isHeld()
    const { '0': client, '1': server } = new WebSocketPair()

    server.serializeAttachment({ holder: !held })
    this.ctx.acceptWebSocket(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: held ? undefined : { 'x-orpc-lock-acquired': 'true' },
    })
  }

  override webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    if (ws.deserializeAttachment().holder) {
      this.handover(ws)
    }
  }

  override webSocketError(ws: WebSocket, _error: unknown): void {
    if (ws.deserializeAttachment().holder) {
      this.handover(ws)
    }
  }

  private isHeld(): boolean {
    const sockets = this.ctx.getWebSockets() // newest first

    for (let i = sockets.length - 1; i >= 0; i--) {
      if (sockets[i]!.deserializeAttachment().holder) {
        return true
      }
    }

    return false
  }

  private handover(previous: WebSocket): void {
    const sockets = this.ctx.getWebSockets() // newest first

    for (let i = sockets.length - 1; i >= 0; i--) {
      const ws = sockets[i]!

      if (ws === previous) {
        continue
      }

      try {
        ws.send('acquired')
      }
      catch {
        continue
      }

      ws.serializeAttachment({ holder: true })
      return
    }
  }
}
