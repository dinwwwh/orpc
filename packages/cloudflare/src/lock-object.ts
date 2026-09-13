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
    const held = this.getOpenWebSockets().length > 0
    const { '0': client, '1': server } = new WebSocketPair()

    server.serializeAttachment({ holder: !held })
    this.ctx.acceptWebSocket(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: held ? undefined : { 'orpc-lock-acquired': 'true' },
    })
  }

  override webSocketClose(): void {
    const next = this.getOpenWebSockets().at(-1) // oldest

    if (next && !next.deserializeAttachment().holder) {
      next.send('acquired')
      next.serializeAttachment({ holder: true })
    }
  }

  private getOpenWebSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN)
  }
}
