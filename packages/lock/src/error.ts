/**
 * Thrown when a lock cannot be acquired before the timeout elapses.
 *
 * @see {@link https://orpc.dev/docs/helpers/lock | Lock Helpers}
 */
export class LockTimeoutError extends Error {
  /**
   * The key of the lock that could not be acquired.
   */
  readonly key: string

  constructor(key: string, options?: ErrorOptions) {
    super(`Timed out waiting for the lock of key "${key}"`, options)

    this.name = 'LockTimeoutError'
    this.key = key
  }
}
