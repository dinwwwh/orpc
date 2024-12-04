import type { Middleware } from './middleware'
import type { DecoratedLazyProcedure, LazyProcedure } from './procedure-lazy'
import type { Router } from './router'
import { isProcedure, type Procedure } from './procedure'
import { decorateLazyProcedure, isLazyProcedure, LAZY_PROCEDURE_SYMBOL } from './procedure-lazy'

export type LazyRouter<TRouter extends Router<any>> = {
  [K in keyof TRouter]: TRouter[K] extends LazyProcedure<infer UContext, infer UExtraContext, infer UInputSchema, infer UOutputSchema, infer UFuncOutput>
    ? DecoratedLazyProcedure<UContext, UExtraContext, UInputSchema, UOutputSchema, UFuncOutput>
    : TRouter[K] extends Procedure<infer UContext, infer UExtraContext, infer UInputSchema, infer UOutputSchema, infer UFuncOutput>
      ? DecoratedLazyProcedure<UContext, UExtraContext, UInputSchema, UOutputSchema, UFuncOutput>
      : TRouter[K] extends Router<any>
        ? LazyRouter<TRouter[K]>
        : never
}

export function createLazyProcedureOrLazyRouter<
  T extends Router<any> | Procedure<any, any, any, any, any>,
>(options: {
  load: () => Promise<T>
  middlewares?: Middleware<any, any, any, any>[]
}):
  T extends Procedure<infer UContext, infer UExtraContext, infer UInputSchema, infer UOutputSchema, infer UFuncOutput>
    ? DecoratedLazyProcedure<UContext, UExtraContext, UInputSchema, UOutputSchema, UFuncOutput>
    : T extends Router<any>
      ? LazyRouter<T>
      : never {
  const result = createLazyProcedureOrLazyRouterInternal({
    load: options.load,
    middlewares: options.middlewares,
  }) as any

  return result
}

function createLazyProcedureOrLazyRouterInternal(
  options: {
    load: () => Promise<Procedure<any, any, any, any, any> | LazyProcedure<any, any, any, any, any> | Router<any>>
    middlewares?: Middleware<any, any, any, any>[]
  },
) {
  const loadProcedure: () => Promise<Procedure<any, any, any, any, any>> = async () => {
    const procedure = await options.load()

    if (isProcedure(procedure)) {
      return procedure
    }

    throw new Error('The loaded procedure is not a valid procedure')
  }

  const lazyProcedure = decorateLazyProcedure({
    load: loadProcedure,
    middlewares: options.middlewares,
  })

  const recursive = new Proxy(lazyProcedure, {
    get(target, key) {
      if (typeof key !== 'string') {
        return Reflect.get(target, key)
      }

      const loadNext: () => Promise<Router<any> | Procedure<any, any, any, any, any> | LazyProcedure<any, any, any, any, any>> = async () => {
        const current = await options.load()
        const next = Reflect.get(current, key)

        if ((typeof next !== 'object' && typeof next !== 'function') || next === null) {
          throw new Error('The loader reached the end of the chain')
        }

        if (isLazyProcedure(next)) {
          return next[LAZY_PROCEDURE_SYMBOL].load()
        }

        return next
      }

      return createLazyProcedureOrLazyRouterInternal({
        load: loadNext,
        middlewares: options.middlewares,
      })
    },
  })

  return recursive
}
