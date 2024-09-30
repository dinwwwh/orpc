import { ContractProcedure, isContractProcedure } from './procedure'
import { HTTPPath, PrefixHTTPPath } from './types'

export type ContractRouter<
  T extends Record<string, ContractProcedure<any, any, any, any> | ContractRouter<any>>
> = T

export type DecoratedContractRouter<TRouter extends ContractRouter<any>> = TRouter & {
  prefix<TPrefix extends Exclude<HTTPPath, undefined>>(
    prefix: TPrefix
  ): DecoratedContractRouter<PrefixContractRouter<TRouter, TPrefix>>
}

export function decorateContractRouter<TRouter extends ContractRouter<any>>(
  router: TRouter
): DecoratedContractRouter<TRouter> {
  const extendedRouter = new Proxy(router as {}, {
    get(rootTarget, prop) {
      if (prop === 'prefix') {
        return Object.assign((prefix: Exclude<HTTPPath, undefined>) => {
          const applyPrefix = (router: ContractRouter<any>) => {
            const clone: Record<
              string,
              ContractProcedure<any, any, any, any> | ContractRouter<any>
            > = {}

            for (const key in router) {
              const item = router[key]

              if (isContractProcedure(item)) {
                clone[key] = item.prefix(prefix)
              } else {
                clone[key] = applyPrefix(item)
              }
            }

            return clone
          }

          const clone = applyPrefix(router)

          return decorateContractRouter(clone)
        }, Reflect.get(rootTarget, prop) ?? {})
      }

      return Reflect.get(rootTarget, prop)
    },
  })

  return extendedRouter as any
}

export type PrefixContractRouter<
  TRouter extends ContractRouter<any>,
  TPrefix extends Exclude<HTTPPath, undefined>
> = {
  [K in keyof TRouter]: TRouter[K] extends ContractProcedure<
    infer TInputSchema,
    infer TOutputSchema,
    infer TMethod,
    infer TPath
  >
    ? ContractProcedure<TInputSchema, TOutputSchema, TMethod, PrefixHTTPPath<TPrefix, TPath>>
    : PrefixContractRouter<TRouter[K], TPrefix>
}