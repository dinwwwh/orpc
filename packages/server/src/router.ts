import {
  ContractProcedure,
  ContractRouter,
  DecoratedContractRouter,
  HTTPPath,
  PrefixHTTPPath,
} from '@orpc/contract'
import { isProcedure, Procedure } from './procedure'
import { Context } from './types'

export type Router<
  TContext extends Context,
  TContract extends ContractRouter<any>
> = TContract extends DecoratedContractRouter<infer UContract>
  ? {
      [K in keyof UContract]: UContract[K] extends ContractProcedure<any, any, any, any>
        ? Procedure<TContext, UContract[K], any, any>
        : Router<TContext, UContract[K]>
    }
  : {
      [K in keyof TContract]: TContract[K] extends ContractProcedure<any, any, any, any>
        ? Procedure<TContext, TContract[K], any, any>
        : Router<TContext, TContract[K]>
    }

export type DecoratedRouter<TRouter extends Router<any, any>> = TRouter & {
  prefix<UPrefix extends Exclude<HTTPPath, undefined>>(
    prefix: UPrefix
  ): DecoratedContractRouter<PrefixRouter<TRouter, UPrefix>>
}

export function decorateRouter<TRouter extends Router<any, any>>(
  router: TRouter
): DecoratedRouter<TRouter> {
  return new Proxy(router, {
    get(target, prop) {
      if (prop === 'prefix') {
        return Object.assign((prefix: Exclude<HTTPPath, undefined>) => {
          const applyPrefix = (router: ContractRouter<any>) => {
            const clone: Record<
              string,
              ContractProcedure<any, any, any, any> | ContractRouter<any>
            > = {}

            for (const key in router) {
              const item = router[key]

              if (isProcedure(item)) {
                clone[key] = item.prefix(prefix)
              } else {
                clone[key] = applyPrefix(item)
              }
            }

            return clone
          }

          const clone = applyPrefix(router)

          return decorateRouter(clone)
        }, Reflect.get(target, prop) ?? {})
      }

      return Reflect.get(target, prop)
    },
  }) as DecoratedRouter<TRouter>
}

export type PrefixRouter<
  TRouter extends Router<any, any>,
  TPrefix extends Exclude<HTTPPath, undefined>
> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<
    infer UContext,
    infer UContract,
    infer UExtraContext,
    infer UHandlerOutput
  >
    ? Procedure<
        UContext,
        UContract extends ContractProcedure<
          infer UInputSchema,
          infer UOutputSchema,
          infer UMethod,
          infer UPath
        >
          ? ContractProcedure<UInputSchema, UOutputSchema, UMethod, PrefixHTTPPath<TPrefix, UPath>>
          : never,
        UExtraContext,
        UHandlerOutput
      >
    : TRouter[K] extends Router<any, any>
    ? PrefixRouter<TRouter[K], TPrefix>
    : never
}