import type { ContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import {
  type ORPCContext,
  type ORPCContextValue,
  createORPCContext,
  useORPCContext,
} from './react-context'
import {
  type ORPCHooksWithContractRouter,
  type ORPCHooksWithRouter,
  createORPCHooks,
} from './react-hooks'
import {
  type ORPCUtilsWithContractRouter,
  type ORPCUtilsWithRouter,
  createORPCUtils,
} from './react-utils'
import {
  type UseQueriesWithContractRouter,
  type UseQueriesWithRouter,
  useQueriesFactory,
} from './use-queries/hook'

export type ORPCReactWithContractRouter<TRouter extends ContractRouter> =
  ORPCHooksWithContractRouter<TRouter> & {
    Provider: ORPCContext<TRouter>['Provider']
    useContext: () => ORPCContextValue<TRouter>
    useUtils: () => ORPCUtilsWithContractRouter<TRouter>
    useQueries: () => UseQueriesWithContractRouter<TRouter>
  }

export type ORPCReactWithRouter<TRouter extends Router<any>> =
  ORPCHooksWithRouter<TRouter> & {
    Provider: ORPCContext<TRouter>['Provider']
    useContext: () => ORPCContextValue<TRouter>
    useUtils: () => ORPCUtilsWithRouter<TRouter>
    useQueries: () => UseQueriesWithRouter<TRouter>
  }

export function createORPCReact<
  TRouter extends ContractRouter | Router<any>,
>(): TRouter extends Router<any>
  ? ORPCReactWithRouter<TRouter>
  : TRouter extends ContractRouter
    ? ORPCReactWithContractRouter<TRouter>
    : never {
  const context = createORPCContext<TRouter>()
  const useContext = () => useORPCContext(context)
  const useUtils = () => createORPCUtils({ contextValue: useContext() })
  const useQueries = useQueriesFactory({ context })
  const hooks = createORPCHooks({ context })

  return new Proxy(
    {
      Provider: context.Provider,
      useContext,
      useUtils,
      useQueries,
    },
    {
      get(target, key) {
        const value = Reflect.get(target, key)
        const nextHooks = Reflect.get(hooks, key)

        if (typeof value !== 'function') {
          return nextHooks
        }

        return new Proxy(value, {
          get(_, key) {
            return Reflect.get(nextHooks, key)
          },
        })
      },
    },
  ) as any
}
