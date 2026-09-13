import { tryOrUndefined } from '@orpc/shared'
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
    const held = this.handover()
    const { '0': client, '1': server } = new WebSocketPair()

    server.serializeAttachment({ holder: !held })
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
    let oldest: WebSocket | undefined

    for (const ws of this.ctx.getWebSockets()) { // newest first
      if (excluded.includes(ws)) {
        continue
      }

      if (ws.deserializeAttachment().holder) {
        return true
      }

      oldest = ws
    }

    if (!oldest) {
      return false
    }

    try {
      oldest.send('acquired')
    }
    catch {
      return this.handover([...excluded, oldest])
    }

    oldest.serializeAttachment({ holder: true })

    return true
  }
}
