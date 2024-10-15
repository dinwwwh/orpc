import type { ContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import {
  type QueriesOptions,
  type QueriesResults,
  useQueries,
} from '@tanstack/react-query'
import { type ORPCContext, useORPCContext } from '../react-context'
import {
  type UseQueriesBuildersWithContractRouter,
  type UseQueriesBuildersWithRouter,
  createUseQueriesBuilders,
} from './builders'

export interface UseQueriesWithContractRouter<TRouter extends ContractRouter> {
  <T extends Array<any>, TCombinedResult = QueriesResults<T>>(
    build: (
      builders: UseQueriesBuildersWithContractRouter<TRouter>,
    ) => [...QueriesOptions<T>],
    combine?: (result: QueriesResults<T>) => TCombinedResult,
  ): TCombinedResult
}

export interface UseQueriesWithRouter<TRouter extends Router<any>> {
  <T extends Array<any>, TCombinedResult = QueriesResults<T>>(
    build: (
      builders: UseQueriesBuildersWithRouter<TRouter>,
    ) => [...QueriesOptions<T>],
    combine?: (result: QueriesResults<T>) => TCombinedResult,
  ): TCombinedResult
}

export interface UseQueriesFactoryOptions<
  TRouter extends Router<any> | ContractRouter,
> {
  context: ORPCContext<TRouter>
}

export function useQueriesFactory<TRouter extends Router<any> | ContractRouter>(
  options: UseQueriesFactoryOptions<TRouter>,
): TRouter extends Router<any>
  ? UseQueriesWithRouter<TRouter>
  : TRouter extends ContractRouter
    ? UseQueriesWithContractRouter<TRouter>
    : never {
  const hook = (build: any, combine?: any) => {
    const orpc = useORPCContext(options.context)
    const builders = createUseQueriesBuilders({ client: orpc.client as any })

    return useQueries({
      queries: build(builders),
      combine: combine,
    })
  }

  return hook as any
}
