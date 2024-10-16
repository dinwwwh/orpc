import type { ProcedureClient } from '@orpc/client'
import type {
  OptionalUndefined,
  Schema,
  SchemaInput,
  SchemaOutput,
} from '@orpc/contract'
import type {
  EnsureInfiniteQueryDataOptions,
  EnsureQueryDataOptions,
  FetchInfiniteQueryOptions,
  FetchQueryOptions,
  InfiniteData,
  QueryClient,
  QueryState,
  SetDataOptions,
  Updater,
} from '@tanstack/react-query'
import type { SetOptional } from 'type-fest'
import { type QueryKey, getQueryKeyFromPath } from './tanstack-key'
import type { SchemaInputForInfiniteQuery } from './types'
import { get } from './utils'

export interface ProcedureUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  fetchQuery: (
    input: SchemaInput<TInputSchema>,
    options?: SetOptional<
      FetchQueryOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaOutput<TOutputSchema, THandlerOutput>,
        QueryKey<'query', SchemaInput<TInputSchema>>
      >,
      'queryKey' | 'queryFn'
    >,
  ) => Promise<SchemaOutput<TOutputSchema, THandlerOutput>>
  fetchInfiniteQuery: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
    options: OptionalUndefined<
      SetOptional<
        FetchInfiniteQueryOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey<'infinite', Omit<SchemaInput<TInputSchema>, 'cursor'>>,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryKey' | 'queryFn'
      >
    >,
  ) => Promise<
    InfiniteData<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      SchemaInput<TInputSchema>['cursor']
    >
  >

  prefetchQuery: (
    input: SchemaInput<TInputSchema>,
    options?: SetOptional<
      FetchQueryOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaOutput<TOutputSchema, THandlerOutput>,
        QueryKey<'query', SchemaInput<TInputSchema>>
      >,
      'queryKey' | 'queryFn'
    >,
  ) => Promise<void>
  prefetchInfiniteQuery: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
    options: OptionalUndefined<
      SetOptional<
        FetchInfiniteQueryOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey<'infinite', Omit<SchemaInput<TInputSchema>, 'cursor'>>,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryKey' | 'queryFn'
      >
    >,
  ) => Promise<void>

  getQueryData: (
    input: SchemaInput<TInputSchema>,
  ) => SchemaOutput<TOutputSchema, THandlerOutput> | undefined
  getInfiniteQueryData: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
  ) =>
    | InfiniteData<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        SchemaInput<TInputSchema>['cursor']
      >
    | undefined

  ensureQueryData: (
    input: SchemaInput<TInputSchema>,
    options?: SetOptional<
      EnsureQueryDataOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaOutput<TOutputSchema, THandlerOutput>,
        QueryKey<'query', SchemaInput<TInputSchema>>
      >,
      'queryFn' | 'queryKey'
    >,
  ) => Promise<SchemaOutput<TOutputSchema, THandlerOutput>>
  ensureInfiniteQueryData: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
    options: OptionalUndefined<
      SetOptional<
        EnsureInfiniteQueryDataOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey<'infinite', Omit<SchemaInput<TInputSchema>, 'cursor'>>,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryKey' | 'queryFn'
      >
    >,
  ) => Promise<
    InfiniteData<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      SchemaInput<TInputSchema>['cursor']
    >
  >

  getQueryState: (
    input: SchemaInput<TInputSchema>,
  ) =>
    | QueryState<SchemaOutput<TOutputSchema, THandlerOutput>, unknown>
    | undefined
  getInfiniteQueryState: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
  ) =>
    | QueryState<
        InfiniteData<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >,
        unknown
      >
    | undefined

  setQueryData: (
    input: SchemaInput<TInputSchema>,
    updater: Updater<
      SchemaOutput<TOutputSchema, THandlerOutput> | undefined,
      SchemaOutput<TOutputSchema, THandlerOutput> | undefined
    >,
    options?: SetDataOptions,
  ) => SchemaOutput<TOutputSchema, THandlerOutput> | undefined
  setInfiniteQueryData: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
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
  ) =>
    | InfiniteData<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        SchemaInput<TInputSchema>['cursor']
      >
    | undefined
}

export interface CreateProcedureUtilsOptions<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  client: ProcedureClient<TInputSchema, TOutputSchema, THandlerOutput>
  queryClient: QueryClient

  /**
   * The path of procedure on sever
   */
  path: string[]
}

export function createProcedureUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateProcedureUtilsOptions<
    TInputSchema,
    TOutputSchema,
    THandlerOutput
  >,
): ProcedureUtils<TInputSchema, TOutputSchema, THandlerOutput> {
  return {
    fetchQuery(input, options_) {
      const client = get(options.client, options.path) as any
      return options.queryClient.fetchQuery({
        queryKey: getQueryKeyFromPath(options.path, { input, type: 'query' }),
        queryFn: () => client(input),
        ...options_,
      })
    },
    fetchInfiniteQuery(input, options_) {
      const client = get(options.client, options.path) as any
      return options.queryClient.fetchInfiniteQuery({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
        queryFn: ({ pageParam }) => client({ ...input, pageParam }),
        ...(options_ as any),
      })
    },

    prefetchQuery(input, options_) {
      const client = get(options.client, options.path) as any
      return options.queryClient.prefetchQuery({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'query',
        }),
        queryFn: () => client(input),
        ...options_,
      })
    },
    prefetchInfiniteQuery(input, options_) {
      const client = get(options.client, options.path) as any
      return options.queryClient.prefetchInfiniteQuery({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
        queryFn: () => client(input),
        ...(options_ as any),
      })
    },

    getQueryData(input) {
      return options.queryClient.getQueryData(
        getQueryKeyFromPath(options.path, {
          input,
          type: 'query',
        }),
      )
    },
    getInfiniteQueryData(input) {
      return options.queryClient.getQueryData(
        getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
      )
    },

    ensureQueryData(input, options_) {
      const client = get(options.client, options.path) as any
      return options.queryClient.ensureQueryData({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'query',
        }),
        queryFn: () => client(input),
        ...options_,
      })
    },
    ensureInfiniteQueryData(input, options_) {
      const client = get(options.client, options.path) as any
      return options.queryClient.ensureInfiniteQueryData({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
        queryFn: ({ pageParam }) => client({ ...input, pageParam }),
        ...(options_ as any),
      })
    },

    getQueryState(input) {
      return options.queryClient.getQueryState(
        getQueryKeyFromPath(options.path, {
          input,
          type: 'query',
        }),
      )
    },
    getInfiniteQueryState(input) {
      return options.queryClient.getQueryState(
        getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
      )
    },

    setQueryData(input, updater, options_) {
      return options.queryClient.setQueryData(
        getQueryKeyFromPath(options.path, {
          input,
          type: 'query',
        }),
        updater,
        options_,
      )
    },
    setInfiniteQueryData(input, updater, options_) {
      return options.queryClient.setQueryData(
        getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
        updater,
        options_,
      )
    },
  }
}
