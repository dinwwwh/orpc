import { DurableObject } from 'cloudflare:workers'

const HOLDER_KEY = 'orpc:lock'

interface LockHolder {
  token: string
  expiresAt: number
}

/**
 * Durable Object base class that backs `experimental_DurableLocker`. One object keeps
 * the holder of one lock key in its storage, so the lock survives eviction.
 *
 * Durable Objects handle one request at a time and pause incoming requests while
 * storage operations are pending, so the check-and-set below is atomic.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLockObject<Env = Cloudflare.Env, Props = unknown> extends DurableObject<Env, Props> {
  /**
   * Stores `token` as the holder unless another holder has not expired yet,
   * and resolves with whether the lock was acquired.
   */
  async acquire(token: string, ttlMs: number): Promise<boolean> {
    const holder = await this.ctx.storage.get<LockHolder>(HOLDER_KEY)

    if (holder && holder.expiresAt > Date.now()) {
      return false
    }

    await this.ctx.storage.put<LockHolder>(HOLDER_KEY, { token, expiresAt: Date.now() + ttlMs })

    return true
  }

  /**
   * Removes the holder only while it is still `token`.
   */
  async release(token: string): Promise<void> {
    const holder = await this.ctx.storage.get<LockHolder>(HOLDER_KEY)

    if (holder?.token === token) {
      await this.ctx.storage.delete(HOLDER_KEY)
    }
  }
}
