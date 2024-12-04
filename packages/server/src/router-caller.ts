import type { Value } from '@orpc/shared'
import type { ANY_PROCEDURE } from './procedure'
import type { Router } from './router'
import { ERROR_ROUTER_REACHED_END } from './error'
import { isProcedure } from './procedure'
import { createProcedureCaller, type ProcedureCaller } from './procedure-caller'
import { type ANY_LAZY_PROCEDURE, isLazyProcedure } from './procedure-lazy'

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
  basePath?: string[]
}

export type RouterCaller<
  TRouter extends Router<any>,
> = {
  [K in keyof TRouter]: TRouter[K] extends ANY_PROCEDURE | ANY_LAZY_PROCEDURE
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
  const caller = createRouterCallerInternal({
    current: options.router,
    context: options.context,
    path: options.basePath ?? [],
  })

  return caller as any
}

function createRouterCallerInternal(
  options: {
    current: Router<any> | Router<any>[keyof Router<any>]
    context: Value<any>
    path: string[]
  },
) {
  const procedureCaller = isLazyProcedure(options.current) || isProcedure(options.current)
    ? createProcedureCaller({
      procedure: options.current,
      context: options.context,
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
        throw ERROR_ROUTER_REACHED_END
      }

      return createRouterCallerInternal({
        current: next,
        context: options.context,
        path: [...options.path, key],
      })
    },
  })

  return recursive
}
