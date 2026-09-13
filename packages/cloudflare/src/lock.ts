import type { LockCallbackOptions, Locker, LockOptions } from '@orpc/experimental-lock'
import type { Promisable } from '@orpc/shared'
import type { experimental_DurableLockObject } from './lock-object'
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
   * Guards against holders that never release the lock, such as a crashed process.
   * Can be overridden per call.
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
 * shares the same locks. Waiting callers park on a hibernatable WebSocket instead
 * of polling, so the object is not billed while they wait.
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
    const stub = this.getStubByName(this.namespace, `${this.prefix}${key}`) as DurableObjectStub<experimental_DurableLockObject>
    const ttlMs = Math.round((options.ttl ?? this.ttl) * 1000)
    const timeoutMs = (options.timeout ?? this.timeout) * 1000
    const token = crypto.randomUUID()
    let waited = false

    options.signal?.throwIfAborted()

    if (!(await stub.acquire(token, ttlMs))) {
      if (timeoutMs <= 0) {
        throw new LockTimeoutError(key)
      }

      waited = true
      await this.wait(stub, key, token, ttlMs, timeoutMs, options.signal)
    }

    try {
      return await fn({ waited })
    }
    finally {
      await stub.release(token)
    }
  }

  /**
   * Parks on a WebSocket until the object hands the lock over, so the object can
   * hibernate meanwhile instead of being polled.
   */
  private async wait(
    stub: DurableObjectStub<experimental_DurableLockObject>,
    key: string,
    token: string,
    ttlMs: number,
    timeoutMs: number,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const response = await stub.fetch('http://localhost/wait', {
      headers: {
        'upgrade': 'websocket',
        'x-orpc-lock-token': token,
        'x-orpc-lock-ttl': String(ttlMs),
      },
    })

    const websocket = response.webSocket

    if (!websocket) {
      throw new Error('Failed to open the waiting websocket to the lock durable object', {
        cause: response,
      })
    }

    const { promise, resolve, reject } = promiseWithResolvers<void>()
    const timer = setTimeout(() => reject(new LockTimeoutError(key)), timeoutMs)
    const abortListener = () => reject(signal?.reason)

    websocket.addEventListener('message', () => resolve())
    websocket.addEventListener('close', () => reject(new Error('The lock durable object closed the waiting websocket before handing the lock over')))
    websocket.addEventListener('error', event => reject(new Error('Waiting websocket error', { cause: event })))
    signal?.addEventListener('abort', abortListener, { once: true })
    websocket.accept()

    try {
      await promise
    }
    catch (error) {
      await stub.release(token) // the lock may have been handed over meanwhile
      throw error
    }
    finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abortListener)
      tryOrUndefined(() => websocket.close())
    }
  }
}
