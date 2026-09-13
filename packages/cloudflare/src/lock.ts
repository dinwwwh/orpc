import type { LockCallbackOptions, Locker, LockOptions } from '@orpc/experimental-lock'
import type { Promisable } from '@orpc/shared'
import { LockTimeoutError } from '@orpc/experimental-lock'
import { promiseWithResolvers, tryOrUndefined } from '@orpc/shared'

export interface experimental_DurableLockerOptions {
  /**
   * The prefix to use for Durable Object names.
   *
   * @default ''
   */
  prefix?: string

  /**
   * How long a lock is held before it expires automatically, in seconds.
   * Guards against holders that never release the lock. A crashed holder releases
   * the lock right away, since its socket drops. Can be overridden per call.
   */
  ttl: number

  /**
   * How long to wait for a lock to become available, in seconds.
   * Can be overridden per call.
   *
   * @default 10
   */
  timeout?: number

  /**
   * Custom function to get the Durable Object stub for a lock key.
   *
   * @default ((namespace, key) => namespace.getByName(key))
   */
  getStubByName?: (namespace: DurableObjectNamespace, key: string) => DurableObjectStub
}

/**
 * Locker adapter for Cloudflare Durable Objects. Keeps each lock in an
 * `experimental_DurableLockObject` named after its key, so every Worker instance
 * shares the same locks. A caller holds a hibernatable WebSocket while it holds or
 * waits for the lock, so the object is not billed meanwhile, and closing the socket
 * releases the lock.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLocker implements Locker {
  private readonly prefix: string
  private readonly ttl: number
  private readonly timeout: number
  private readonly getStubByName: Exclude<experimental_DurableLockerOptions['getStubByName'], undefined>

  constructor(
    private readonly namespace: DurableObjectNamespace<any>,
    options: experimental_DurableLockerOptions,
  ) {
    this.prefix = options.prefix ?? ''
    this.ttl = options.ttl
    this.timeout = options.timeout ?? 10
    this.getStubByName = options.getStubByName ?? ((namespace, key) => namespace.getByName(key))
  }

  async lock<T>(key: string, fn: (options: LockCallbackOptions) => Promisable<T>, options: LockOptions = {}): Promise<T> {
    const stub = this.getStubByName(this.namespace, `${this.prefix}${key}`)
    const ttlMs = Math.round((options.ttl ?? this.ttl) * 1000)
    const timeoutMs = (options.timeout ?? this.timeout) * 1000
    const headers: Record<string, string> = { upgrade: 'websocket' }

    options.signal?.throwIfAborted()

    if (timeoutMs > 0) {
      headers['x-orpc-lock-wait'] = 'true'
    }

    const response = await stub.fetch('http://localhost/acquire', { headers })

    if (response.status === 409) {
      throw new LockTimeoutError(key)
    }

    const websocket = response.webSocket

    if (!websocket) {
      throw new Error(`Failed to acquire the lock: ${response.status} ${response.statusText}`, {
        cause: response,
      })
    }

    const closed = promiseWithResolvers<void>()
    websocket.addEventListener('close', () => closed.resolve())
    websocket.addEventListener('error', () => closed.resolve())

    let waited: boolean

    try {
      ({ waited } = await this.acquired(websocket, key, timeoutMs, options.signal))
    }
    catch (error) {
      tryOrUndefined(() => websocket.close(1000))
      throw error
    }

    // The lock lapses when the ttl elapses, even while `fn` is still running.
    const expiry = setTimeout(() => tryOrUndefined(() => websocket.close(1000)), ttlMs)

    try {
      return await fn({ waited })
    }
    finally {
      clearTimeout(expiry)
      tryOrUndefined(() => websocket.close(1000))
      await closed.promise // the object hands the lock over before we return
    }
  }

  /**
   * Resolves once the object hands the lock over to this socket, right away or after
   * parking on it while the object hibernates, so the object is never polled.
   */
  private acquired(websocket: WebSocket, key: string, timeoutMs: number, signal: AbortSignal | undefined): Promise<LockCallbackOptions> {
    const { promise, resolve, reject } = promiseWithResolvers<LockCallbackOptions>()
    const timer = timeoutMs > 0 ? setTimeout(() => reject(new LockTimeoutError(key)), timeoutMs) : undefined
    const abortListener = () => reject(signal?.reason)

    websocket.addEventListener('message', event => resolve(JSON.parse(event.data as string)))
    websocket.addEventListener('close', () => reject(new Error('The lock durable object closed the socket before handing the lock over')))
    websocket.addEventListener('error', event => reject(new Error('Lock websocket error', { cause: event })))
    signal?.addEventListener('abort', abortListener, { once: true })
    websocket.accept()

    return promise.finally(() => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abortListener)
    })
  }
}
