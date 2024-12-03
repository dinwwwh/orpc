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
    const handled: Router<TContext> = {}

    for (const key in router) {
      const item = router[key]

      if (isProcedure(item)) {
        const builderMiddlewares = this.zz$rb.middlewares ?? []
        const itemMiddlewares = item.zz$p.middlewares ?? []

        const middlewares = [
          ...builderMiddlewares,
          ...itemMiddlewares.filter(
            item => !builderMiddlewares.includes(item),
          ),
        ]

        const contract = DecoratedContractProcedure.decorate(
          item.zz$p.contract,
        ).addTags(...(this.zz$rb.tags ?? []))

        handled[key] = decorateProcedure({
          zz$p: {
            ...item.zz$p,
            contract: this.zz$rb.prefix
              ? contract.prefix(this.zz$rb.prefix)
              : contract,
            middlewares,
          },
        })
      }
      else {
        handled[key] = this.router(item as any)
      }
    }

    return handled as HandledRouter<URouter>
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
