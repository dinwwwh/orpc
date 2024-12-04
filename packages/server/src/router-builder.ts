import type { ANY_PROCEDURE, DecoratedProcedure, Procedure } from './procedure'
import type { Router } from './router'
import type { LazyRouter } from './router-lazy'
import type { Context, MergeContext } from './types'
import { DecoratedContractProcedure, type HTTPPath } from '@orpc/contract'
import { decorateMiddleware, type MapInputMiddleware, type Middleware } from './middleware'
import { decorateProcedure, isProcedure } from './procedure'
import { createLazyProcedure, type DecoratedLazyProcedure, decorateLazyProcedure, isLazyProcedure, LAZY_PROCEDURE_LOADER_SYMBOL, type LazyProcedure } from './procedure-lazy'
import { createLazyProcedureOrLazyRouter } from './router-lazy'

export type AdaptedRouter<TRouter extends Router<any>> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<infer UContext, infer UExtraContext, infer UInputSchema, infer UOutputSchema, infer UFuncOutput>
    ? DecoratedProcedure<UContext, UExtraContext, UInputSchema, UOutputSchema, UFuncOutput>
    : TRouter[K] extends LazyProcedure<Procedure<infer UContext, infer UExtraContext, infer UInputSchema, infer UOutputSchema, infer UFuncOutput>>
      ? DecoratedLazyProcedure<Procedure<UContext, UExtraContext, UInputSchema, UOutputSchema, UFuncOutput>>
      : TRouter[K] extends Router<any>
        ? AdaptedRouter<TRouter[K]>
        : never
}

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
  ): AdaptedRouter<URouter> {
    return adaptRouter({
      routerOrChild: router,
      middlewares: this.zz$rb.middlewares,
      tags: this.zz$rb.tags,
      prefix: this.zz$rb.prefix,
    }) as any
  }

  lazy<U extends Router<TContext>>(
    load: () => Promise<{ default: U }>,
  ): AdaptedRouter<LazyRouter<U>> {
    return adaptRouter({
      routerOrChild: createLazyProcedureOrLazyRouter(() => load().then(r => r.default)),
      middlewares: this.zz$rb.middlewares,
      tags: this.zz$rb.tags,
      prefix: this.zz$rb.prefix,
    }) as any
  }
}

function adaptRouter(options: {
  routerOrChild: Router<any> | Router<any>[keyof Router<any>]
  middlewares?: Middleware<any, any, any, any>[]
  tags?: string[]
  prefix?: HTTPPath
}) {
  if (isProcedure(options.routerOrChild)) {
    return adaptProcedure({
      ...options,
      procedure: options.routerOrChild,
    })
  }

  let procedure: DecoratedLazyProcedure<ANY_PROCEDURE> | undefined

  if (isLazyProcedure(options.routerOrChild)) {
    const loader = options.routerOrChild[LAZY_PROCEDURE_LOADER_SYMBOL]

    procedure = decorateLazyProcedure(createLazyProcedure(
      async () => adaptProcedure({
        ...options,
        procedure: await loader(),
      }),
    ))
  }

  const recursive = new Proxy(procedure ?? options.routerOrChild, {
    get(target, key) {
      if (typeof key !== 'string') {
        return Reflect.get(target, key)
      }

      const child = Reflect.get(options.routerOrChild, key) as Router<any>[keyof Router<any>] | undefined

      if ((typeof child !== 'object' && typeof child !== 'function') || child === null) {
        throw new Error('Reached the end of the router')
      }

      return adaptRouter({
        ...options,
        routerOrChild: child,
      })
    },
  })

  return recursive
}

function adaptProcedure(options: {
  procedure: Procedure<any, any, any, any, any>
  middlewares?: Middleware<any, any, any, any>[]
  tags?: string[]
  prefix?: HTTPPath
}): DecoratedProcedure<any, any, any, any, any> {
  const builderMiddlewares = options.middlewares ?? []
  const procedureMiddlewares = options.procedure.zz$p.middlewares ?? []

  const middlewares = [
    ...builderMiddlewares,
    ...procedureMiddlewares.filter(
      item => !builderMiddlewares.includes(item),
    ),
  ]

  const contract = DecoratedContractProcedure.decorate(
    options.procedure.zz$p.contract,
  ).addTags(...(options.tags ?? []))

  return decorateProcedure({
    zz$p: {
      ...options.procedure.zz$p,
      contract: options.prefix
        ? contract.prefix(options.prefix)
        : contract,
      middlewares,
    },
  })
}
