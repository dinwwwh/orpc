import type { ProcedureClient } from '@orpc/client'
import type { Schema, SchemaInput, SchemaOutput } from '@orpc/contract'
import type {
  CancelOptions,
  InfiniteData,
  InvalidateOptions,
  MutationFilters,
  OmitKeyof,
  QueryClient,
  RefetchOptions,
  ResetOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/react-query'
import type { PartialDeep, SetOptional } from 'type-fest'
import {
  type QueryKey,
  type QueryType,
  getMutationKeyFromPath,
  getQueryKeyFromPath,
} from './tanstack-key'
import type {
  ORPCInvalidateQueryFilters,
  ORPCQueryFilters,
} from './tanstack-query'

export interface GeneralUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  getQueriesData: <
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: OmitKeyof<ORPCQueryFilters<undefined, TFilterInput>, 'queryType'>,
  ) => [
    QueryKey<'query', TFilterInput>,
    SchemaOutput<TOutputSchema, THandlerOutput> | undefined,
  ]
  getInfiniteQueriesData: <
    TFilterInput extends
      | (PartialDeep<Omit<SchemaInput<TInputSchema>, 'cursor'>> &
          Record<string | number, any>)
      | undefined = undefined,
  >(
    filters?: OmitKeyof<ORPCQueryFilters<undefined, TFilterInput>, 'queryType'>,
  ) => [
    QueryKey<'infinite', TFilterInput>,
    (
      | InfiniteData<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >
      | undefined
    ),
  ]

  setQueriesData: <
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters: OmitKeyof<ORPCQueryFilters<undefined, TFilterInput>, 'queryType'>,
    updater: Updater<
      SchemaOutput<TOutputSchema, THandlerOutput> | undefined,
      SchemaOutput<TOutputSchema, THandlerOutput> | undefined
    >,
    options?: SetDataOptions,
  ) => [
    QueryKey<'query', TFilterInput>,
    SchemaOutput<TOutputSchema, THandlerOutput> | undefined,
  ]
  setInfiniteQueriesData: <
    TFilterInput extends
      | (PartialDeep<Omit<SchemaInput<TInputSchema>, 'cursor'>> &
          Record<string | number, any>)
      | undefined = undefined,
  >(
    filters: OmitKeyof<ORPCQueryFilters<undefined, TFilterInput>, 'queryType'>,
    updater: Updater<
      InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>> | undefined,
      InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>> | undefined
    >,
    options?: SetDataOptions,
  ) => [
    QueryKey<'infinite', TFilterInput>,
    (
      | InfiniteData<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >
      | undefined
    ),
  ]

  invalidate: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCInvalidateQueryFilters<TQueryType, TFilterInput>,
    options?: InvalidateOptions,
  ) => Promise<void>
  refetch: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
    options?: RefetchOptions,
  ) => Promise<void>
  cancel: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
    options?: CancelOptions,
  ) => Promise<void>
  remove: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
  ) => void
  reset: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
    options?: ResetOptions,
  ) => Promise<void>

  isFetching: (filters?: ORPCQueryFilters<any, any>) => number
  isMutating: (filters?: SetOptional<MutationFilters, 'mutationKey'>) => number
}

export interface CreateGeneralUtilsOptions<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  client: ProcedureClient<TInputSchema, TOutputSchema, THandlerOutput>
  queryClient: QueryClient

  /**
   * The path of the router or procedure on server.
   *
   * @internal
   */
  path: string[]
}

export function createGeneralUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateGeneralUtilsOptions<
    TInputSchema,
    TOutputSchema,
    THandlerOutput
  >,
): GeneralUtils<TInputSchema, TOutputSchema, THandlerOutput> {
  return {
    getQueriesData(filters) {
      const { input, ...rest } = filters ?? {}
      return options.queryClient.getQueriesData({
        queryKey: getQueryKeyFromPath(options.path, { input, type: 'query' }),
        ...rest,
      }) as any
    },
    getInfiniteQueriesData(filters) {
      const { input, ...rest } = filters ?? {}
      return options.queryClient.getQueriesData({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
        ...rest,
      }) as any
    },

    setQueriesData(filters, updater, options_) {
      const { input, ...rest } = filters ?? {}
      return options.queryClient.setQueriesData(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: 'query',
          }),
          ...rest,
        },
        updater,
        options_,
      ) as any
    },
    setInfiniteQueriesData(filters, updater, options_) {
      const { input, ...rest } = filters ?? {}
      return options.queryClient.setQueriesData(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: 'infinite',
          }),
          ...rest,
        },
        updater,
        options_,
      ) as any
    },

    invalidate(filters, options_) {
      const { input, queryType, ...rest } = filters ?? {}
      return options.queryClient.invalidateQueries(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: queryType,
          }),
          ...rest,
        },
        options_,
      )
    },
    refetch(filters, options_) {
      const { input, queryType, ...rest } = filters ?? {}
      return options.queryClient.refetchQueries(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: queryType,
          }),
          ...rest,
        },
        options_,
      )
    },
    cancel(filters, options_) {
      const { input, queryType, ...rest } = filters ?? {}
      return options.queryClient.cancelQueries(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: queryType,
          }),
          ...rest,
        },
        options_,
      )
    },
    remove(filters) {
      const { input, queryType, ...rest } = filters ?? {}
      return options.queryClient.removeQueries({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: queryType,
        }),
        ...rest,
      })
    },
    reset(filters, options_) {
      const { input, queryType, ...rest } = filters ?? {}
      return options.queryClient.resetQueries(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: queryType,
          }),
          ...rest,
        },
        options_,
      )
    },

    isFetching(filters) {
      const { input, queryType, ...rest } = filters ?? {}
      return options.queryClient.isFetching({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: queryType,
        }),
        ...rest,
      })
    },
    isMutating(filters) {
      return options.queryClient.isMutating({
        mutationKey: getMutationKeyFromPath(options.path),
        ...filters,
      })
    },
  }
}
