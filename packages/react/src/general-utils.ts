import type { Schema, SchemaInput, SchemaOutput } from '@orpc/contract'
import type {
  CancelOptions,
  InfiniteData,
  InvalidateOptions,
  MutationFilters,
  MutationObserverOptions,
  OmitKeyof,
  QueryClient,
  QueryObserverOptions,
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
import type { SchemaInputForInfiniteQuery } from './types'

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
  ][]
  getInfiniteQueriesData: <
    TFilterInput extends
      | PartialDeep<SchemaInputForInfiniteQuery<TInputSchema>>
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
  ][]

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
  ][]
  setInfiniteQueriesData: <
    TFilterInput extends
      | PartialDeep<SchemaInputForInfiniteQuery<TInputSchema>>
      | undefined = undefined,
  >(
    filters: OmitKeyof<ORPCQueryFilters<undefined, TFilterInput>, 'queryType'>,
    updater: Updater<
      | InfiniteData<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >
      | undefined,
      | InfiniteData<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >
      | undefined
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
  ][]

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

  isFetching: (
    filters?: ORPCQueryFilters<any, PartialDeep<SchemaInput<TInputSchema>>>,
  ) => number
  isMutating: (filters?: SetOptional<MutationFilters, 'mutationKey'>) => number

  getQueryDefaults: <
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: Pick<
      ORPCQueryFilters<undefined, TFilterInput>,
      'input' | 'queryKey'
    >,
  ) => OmitKeyof<
    QueryObserverOptions<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      unknown,
      SchemaOutput<TOutputSchema, THandlerOutput>,
      SchemaOutput<TOutputSchema, THandlerOutput>,
      QueryKey<'query', TFilterInput>
    >,
    'queryKey'
  >
  getInfiniteQueryDefaults: <
    TFilterInput extends
      | PartialDeep<SchemaInputForInfiniteQuery<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: Pick<
      ORPCQueryFilters<undefined, TFilterInput>,
      'input' | 'queryKey'
    >,
  ) => OmitKeyof<
    QueryObserverOptions<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      unknown,
      SchemaOutput<TOutputSchema, THandlerOutput>,
      InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>>,
      QueryKey<'infinite', TFilterInput>,
      SchemaInput<TInputSchema>['cursor']
    >,
    'queryKey'
  >

  setQueryDefaults: <
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    options: Partial<
      OmitKeyof<
        QueryObserverOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey<'query', TFilterInput>
        >,
        'queryKey'
      >
    >,
    filters?: Pick<
      ORPCQueryFilters<undefined, TFilterInput>,
      'input' | 'queryKey'
    >,
  ) => void
  setInfiniteQueryDefaults: <
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    options: Partial<
      OmitKeyof<
        QueryObserverOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>>,
          QueryKey<'infinite', TFilterInput>,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryKey'
      >
    >,
    filters?: Pick<
      ORPCQueryFilters<undefined, TFilterInput>,
      'input' | 'queryKey'
    >,
  ) => void

  getMutationDefaults: (
    filters?: Pick<MutationFilters, 'mutationKey'>,
  ) => MutationObserverOptions<
    SchemaOutput<TOutputSchema, THandlerOutput>,
    unknown,
    SchemaInput<TInputSchema>,
    unknown
  >
  setMutationDefaults: (
    options: OmitKeyof<
      MutationObserverOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaInput<TInputSchema>,
        unknown
      >,
      'mutationKey'
    >,
    filters?: Pick<MutationFilters, 'mutationKey'>,
  ) => void
}

export interface CreateGeneralUtilsOptions {
  queryClient: QueryClient

  /**
   * The path of the router or procedure on server.
   *
   * @internal
   */
  path: string[]
}

export function createGeneralUtils<
  TInputSchema extends Schema = undefined,
  TOutputSchema extends Schema = undefined,
  THandlerOutput extends
    SchemaOutput<TOutputSchema> = SchemaOutput<TOutputSchema>,
>(
  options: CreateGeneralUtilsOptions,
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

    getQueryDefaults(filters) {
      return options.queryClient.getQueryDefaults(
        filters?.queryKey ??
          getQueryKeyFromPath(options.path, {
            input: filters?.input,
            type: 'query',
          }),
      )
    },
    getInfiniteQueryDefaults(filters) {
      return options.queryClient.getQueryDefaults(
        filters?.queryKey ??
          getQueryKeyFromPath(options.path, {
            input: filters?.input,
            type: 'infinite',
          }),
      ) as any
    },

    setQueryDefaults(options_, filters) {
      return options.queryClient.setQueryDefaults(
        filters?.queryKey ??
          getQueryKeyFromPath(options.path, {
            input: filters?.input,
            type: 'query',
          }),
        options_ as any,
      )
    },
    setInfiniteQueryDefaults(options_, filters) {
      return options.queryClient.setQueryDefaults(
        filters?.queryKey ??
          getQueryKeyFromPath(options.path, {
            input: filters?.input,
            type: 'infinite',
          }),
        options_ as any,
      )
    },

    getMutationDefaults(filters) {
      return options.queryClient.getMutationDefaults(
        filters?.mutationKey ?? getMutationKeyFromPath(options.path),
      )
    },
    setMutationDefaults(options_, filters) {
      return options.queryClient.setMutationDefaults(
        filters?.mutationKey ?? getMutationKeyFromPath(options.path),
        options_,
      )
    },
  }
}
