export const LAZY_LOADER_SYMBOL: unique symbol = Symbol('ORPC_LAZY_LOADER')

export interface Lazy<T> {
  [LAZY_LOADER_SYMBOL]: () => Promise<{ default: T }>
}

export type ANY_LAZY = Lazy<any>

export function lazy<T>(loader: () => Promise<{ default: T }>): Lazy<T> {
  return {
    [LAZY_LOADER_SYMBOL]: loader,
  }
}

export function isLazy(item: unknown): item is ANY_LAZY {
  return (
    (typeof item === 'object' || typeof item === 'function')
    && item !== null
    && LAZY_LOADER_SYMBOL in item
    && typeof item[LAZY_LOADER_SYMBOL] === 'function'
  )
}

export function unwrapLazy<T>(lazy: Lazy<T>): Promise<{ default: T }> {
  return lazy[LAZY_LOADER_SYMBOL]()
}

export type FlattenLazy<T> = T extends Lazy<infer U>
  ? FlattenLazy<U>
  : Lazy<T>

export function flatLazy<T>(lazy: Lazy<T>): FlattenLazy<T> {
  const flattenLoader = async () => {
    let current = await unwrapLazy(lazy)

    while (true) {
      if (!isLazy(current.default)) {
        break
      }

      current = await unwrapLazy(current.default)
    }

    return current
  }

  const flattenLazy = {
    [LAZY_LOADER_SYMBOL]: flattenLoader,
  }

  return flattenLazy as any
}
