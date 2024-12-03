import type { DecoratedProcedure, Procedure } from './procedure'
import type { DecoratedLazyProcedure, LazyProcedure } from './procedure-lazy'
import type { HandledRouter, Router } from './router'
import type { LazyRouter } from './router-lazy'
import type { Context, MergeContext } from './types'
import { DecoratedContractProcedure, type HTTPPath } from '@orpc/contract'
import {
  decorateMiddleware,
  type MapInputMiddleware,
  type Middleware,
} from './middleware'
import { decorateProcedure, isProcedure } from './procedure'
import { decorateLazyProcedure, isLazyProcedure, LAZY_PROCEDURE_SYMBOL } from './procedure-lazy'
import { createLazyProcedureOrLazyRouter } from './router-lazy'

export class RouterBuilder<
  TContext extends Context,
  TExtraContext extends Context,
> {
  constructor(
    public zz$rb: {
      prefix?: HTTPPath
      tags?: string[]
      middlewares?: Middleware<any, any, any, any>[]
    },
  ) {}

  prefix(prefix: HTTPPath): RouterBuilder<TContext, TExtraContext> {
    return new RouterBuilder({
      ...this.zz$rb,
      prefix: `${this.zz$rb.prefix ?? ''}${prefix}`,
    })
  }

  tags(...tags: string[]): RouterBuilder<TContext, TExtraContext> {
    if (!tags.length)
      return this

    return new RouterBuilder({
      ...this.zz$rb,
      tags: [...(this.zz$rb.tags ?? []), ...tags],
    })
  }

  use<
    UExtraContext extends
    | Partial<MergeContext<Context, MergeContext<TContext, TExtraContext>>>
    | undefined = undefined,
  >(
    middleware: Middleware<
      MergeContext<TContext, TExtraContext>,
      UExtraContext,
      unknown,
      unknown
    >,
  ): RouterBuilder<TContext, MergeContext<TExtraContext, UExtraContext>>

  use<
    UExtraContext extends
    | Partial<MergeContext<Context, MergeContext<TContext, TExtraContext>>>
    | undefined = undefined,
    UMappedInput = unknown,
  >(
    middleware: Middleware<
      MergeContext<TContext, TExtraContext>,
      UExtraContext,
      UMappedInput,
      unknown
    >,
    mapInput: MapInputMiddleware<unknown, UMappedInput>,
  ): RouterBuilder<TContext, MergeContext<TExtraContext, UExtraContext>>

  use(
    middleware: Middleware<any, any, any, any>,
    mapInput?: MapInputMiddleware<any, any>,
  ): RouterBuilder<any, any> {
    const middleware_ = mapInput
      ? decorateMiddleware(middleware).mapInput(mapInput)
      : middleware

    return new RouterBuilder({
      ...this.zz$rb,
      middlewares: [...(this.zz$rb.middlewares || []), middleware_],
    })
  }

  router<URouter extends Router<TContext>>(
    router: URouter,
  ): HandledRouter<URouter> {
    return createRouterInternal({
      current: router,
      middlewares: this.zz$rb.middlewares,
      tags: this.zz$rb.tags,
      prefix: this.zz$rb.prefix,
    }) as any
  }

  lazy<U extends Router<TContext>>(
    load: () => Promise<{ default: U }>,
  ): LazyRouter<U> {
    return createLazyProcedureOrLazyRouter({
      load: async () => (await load()).default,
      middlewares: this.zz$rb.middlewares,
    }) as any
  }
}

/**
 * @internal
 */
function createRouterInternal(options: {
  current: Router<any> | Procedure<any, any, any, any, any> | LazyProcedure<any, any, any, any, any>
  middlewares?: Middleware<any, any, any, any>[]
  tags?: string[]
  prefix?: HTTPPath
}) {
  if (isProcedure(options.current)) {
    const builderMiddlewares = options.middlewares ?? []
    const itemMiddlewares = options.current.zz$p.middlewares ?? []

    const middlewares = [
      ...builderMiddlewares,
      ...itemMiddlewares.filter(
        item => !builderMiddlewares.includes(item),
      ),
    ]

    const contract = DecoratedContractProcedure.decorate(
      options.current.zz$p.contract,
    ).addTags(...(options.tags ?? []))

    return decorateProcedure({
      zz$p: {
        ...options.current.zz$p,
        contract: options.prefix
          ? contract.prefix(options.prefix)
          : contract,
        middlewares,
      },
    })
  }

  let procedure: DecoratedLazyProcedure<any, any, any, any, any> | undefined

  if (isLazyProcedure(options.current)) {
    procedure = decorateLazyProcedure({
      ...options.current[LAZY_PROCEDURE_SYMBOL],
      middlewares: options.middlewares,
    })
  }

  const recursive = new Proxy(procedure ?? {}, {
    get(target, key) {
      if (typeof key !== 'string') {
        return Reflect.get(target, key)
      }

      const next = Reflect.get(options.current, key)

      if ((typeof next !== 'object' && typeof next !== 'function') || next === null) {
        return next
      }

      return createRouterInternal({
        current: next,
        middlewares: options.middlewares,
        tags: options.tags,
        prefix: options.prefix,
      })
    },
  })

  return recursive
}
