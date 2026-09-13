/**
 * Thrown when a lock cannot be acquired before the timeout elapses.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock#timeout | Lock Helpers - Timeout}
 */
export class LockTimeoutError extends Error {
  /**
   * The key of the lock that could not be acquired.
   */
  readonly key: string

  constructor(key: string) {
    super(`Timed out waiting for the lock of key "${key}"`)

    this.name = 'LockTimeoutError'
    this.key = key
  }
}
