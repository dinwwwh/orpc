import type { BaseLockerOptions } from '@orpc/experimental-lock'
import type { experimental_DurableLockObject } from './lock-object'
import { BaseLocker } from '@orpc/experimental-lock'

export interface experimental_DurableLockerOptions extends BaseLockerOptions {
  /**
   * Custom function to get the Durable Object stub for a lock key.
   *
   * @default ((namespace, key) => namespace.getByName(key))
   */
  getStubByName?: (namespace: DurableObjectNamespace, key: string) => DurableObjectStub
}

/**
 * Locker adapter for Cloudflare Durable Objects. Keeps each lock in an
 * `experimental_DurableLockObject` named after its key, so every Worker
 * instance shares the same locks.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#adapters | Lock Helpers - Adapters}
 */
export class experimental_DurableLocker extends BaseLocker {
  private readonly getStubByName: Exclude<experimental_DurableLockerOptions['getStubByName'], undefined>

  constructor(
    private readonly namespace: DurableObjectNamespace<any>,
    { getStubByName, ...options }: experimental_DurableLockerOptions,
  ) {
    super(options)

    this.getStubByName = getStubByName ?? ((namespace, key) => namespace.getByName(key))
  }

  protected async acquire(key: string, token: string, ttlMs: number): Promise<boolean> {
    return await this.getStub(key).acquire(token, ttlMs)
  }

  protected async release(key: string, token: string): Promise<void> {
    await this.getStub(key).release(token)
  }

  private getStub(key: string): DurableObjectStub<experimental_DurableLockObject> {
    return this.getStubByName(this.namespace, key) as DurableObjectStub<experimental_DurableLockObject>
  }
}
