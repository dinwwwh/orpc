import type { Router } from './router'
import { type ANY_PROCEDURE, isProcedure } from './procedure'
import { type ANY_LAZY_PROCEDURE, createLazyProcedure, type DecoratedLazyProcedure, decorateLazyProcedure, isLazyProcedure, LAZY_PROCEDURE_LOADER_SYMBOL, type LazyProcedure } from './procedure-lazy'

export const LAZY_ROUTER_LOADER_SYMBOL = Symbol('ORPC_LAZY_ROUTER_LOADER')

export type LazyRouter<T extends Router<any>> = {
  [K in keyof T]: T[K] extends ANY_PROCEDURE
    ? DecoratedLazyProcedure<T[K]>
    : T[K] extends LazyProcedure<infer U>
      ? DecoratedLazyProcedure<U>
      : T[K] extends Router<any>
        ? LazyRouter<T[K]>
        : never
}

export function createLazyProcedureOrLazyRouter<T extends Router<any> | ANY_PROCEDURE>(
  loader: () => Promise<T>,
): T extends ANY_PROCEDURE ? DecoratedLazyProcedure<T> : T extends Router<any> ? LazyRouter<T> : never {
  const procedureLoader = async (): Promise<ANY_PROCEDURE> => {
    const procedure = await loader()

    if (!isProcedure(procedure)) {
      throw new Error('The loaded procedure is not a valid procedure')
    }

    return procedure
  }

  const lazyProcedure = Object.assign(
    decorateLazyProcedure(createLazyProcedure(procedureLoader)),
    {
      [LAZY_ROUTER_LOADER_SYMBOL]: loader,
    },
  )

  const recursive = new Proxy(lazyProcedure, {
    get(target, key) {
      if (typeof key !== 'string') {
        return Reflect.get(target, key)
      }

      const nextLoader = async (): Promise<Router<any> | ANY_PROCEDURE> => {
        const current = await loader()
        const next = Reflect.get(current, key) as Router<any> | ANY_PROCEDURE | ANY_LAZY_PROCEDURE | undefined

        if ((typeof next !== 'object' && typeof next !== 'function') || next === null) {
          throw new Error('The loader reached the end of the chain')
        }

        if (LAZY_ROUTER_LOADER_SYMBOL in next && typeof next[LAZY_ROUTER_LOADER_SYMBOL] === 'function') {
          return next[LAZY_ROUTER_LOADER_SYMBOL]()
        }

        if (isLazyProcedure(next)) {
          return next[LAZY_PROCEDURE_LOADER_SYMBOL]()
        }

        return next
      }

      return createLazyProcedureOrLazyRouter(nextLoader)
    },
  })

  return recursive as any
}
