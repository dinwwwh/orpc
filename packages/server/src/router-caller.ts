import type { Value } from '@orpc/shared'
import type { Router } from './router'
import { isProcedure, type Procedure } from './procedure'
import { createProcedureCaller, type ProcedureCaller } from './procedure-caller'
import { isLazyProcedure, type LazyProcedure } from './procedure-lazy'

export interface CreateRouterCallerOptions<
  TRouter extends Router<any>,
> {
  router: TRouter

  /**
   * The context used when calling the procedure.
   */
  context: Value<
    TRouter extends Router<infer UContext> ? UContext : never
  >

  /**
   * This is helpful for logging and analytics.
   *
   * @internal
   */
  path?: string[]
}

export type RouterCaller<
  TRouter extends Router<any>,
> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<any, any, any, any, any> | LazyProcedure<any, any, any, any, any>
    ? ProcedureCaller<TRouter[K]>
    : TRouter[K] extends Router<any>
      ? RouterCaller<TRouter[K]>
      : never
}

export function createRouterCaller<
  TRouter extends Router<any>,
>(
  options: CreateRouterCallerOptions<TRouter>,
): RouterCaller<TRouter> {
  return createRouterCallerInternal({
    current: options.router,
    context: options.context,
    path: options.path ?? [],
  }) as any
}

function createRouterCallerInternal(
  options: {
    current: Procedure<any, any, any, any, any> | LazyProcedure<any, any, any, any, any> | Router<any>
    context: Value<any>
    path: string[]
  },
) {
  const procedureCaller = isLazyProcedure(options.current) || isProcedure(options.current)
    ? createProcedureCaller({
      procedure: options.current,
      context: options.context as any,
      path: options.path,
    })
    : {}

  const recursive = new Proxy(procedureCaller, {
    get(target, key) {
      if (typeof key !== 'string') {
        return Reflect.get(target, key)
      }

      const next = Reflect.get(options.current, key)

      if ((typeof next !== 'object' && typeof next !== 'function') || next === null) {
        throw new Error('The loader reached the end of the chain')
      }

      return createRouterCallerInternal({
        current: next,
        context: options.context,
        path: [...(options.path ?? []), key],
      })
    },
  })

  return recursive
}
