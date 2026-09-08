/**
 * A per-key mutex. Callers of one key run one at a time, while other keys
 * run independently.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export interface Lock {
  /**
   * Runs `fn` once the key is free. `waited` is `true` when another caller
   * held it first.
   */
  run<T>(key: string, fn: (waited: boolean) => Promise<T>): Promise<T>
}

/**
 * A {@link Lock} held within one process, in call order.
 *
 * @see {@link https://orpc.dev/docs/helpers/cache#adapters | Cache Helpers - Adapters}
 */
export class MemoryLock implements Lock {
  private readonly pending = new Map<string, Promise<unknown>>()

  async run<T>(key: string, fn: (waited: boolean) => Promise<T>): Promise<T> {
    const previous = this.pending.get(key)
    const run = () => fn(previous !== undefined)
    const current = previous?.then(run, run) ?? run()

    this.pending.set(key, current)

    try {
      return await current
    }
    finally {
      if (this.pending.get(key) === current) {
        this.pending.delete(key)
      }
    }
  }
}
