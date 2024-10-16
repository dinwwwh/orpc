import type {
  OptionalUndefined,
  Schema,
  SchemaInput,
  SchemaOutput,
} from '@orpc/contract'
import {
  type FetchInfiniteQueryOptions,
  type FetchQueryOptions,
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  type UseSuspenseInfiniteQueryOptions,
  type UseSuspenseInfiniteQueryResult,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
  useInfiniteQuery,
  useMutation,
  usePrefetchInfiniteQuery,
  usePrefetchQuery,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import type { PartialOnUndefinedDeep, SetOptional } from 'type-fest'
import { orpcPathSymbol } from './orpc-path'
import { type ORPCContext, useORPCContext } from './react-context'
import {
  type QueryKey,
  getMutationKeyFromPath,
  getQueryKeyFromPath,
} from './tanstack-key'
import type { SchemaInputForInfiniteQuery } from './types'
import { get } from './utils'

export interface ProcedureHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  useQuery: <USelectData = SchemaOutput<TOutputSchema, THandlerOutput>>(
    input: SchemaInput<TInputSchema>,
    options?: SetOptional<
      UseQueryOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        USelectData,
        QueryKey<'query', SchemaInput<TInputSchema>>
      >,
      'queryFn' | 'queryKey'
    >,
  ) => UseQueryResult<USelectData, unknown>
  useInfiniteQuery: <
    USelectData = InfiniteData<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      SchemaInput<TInputSchema>['cursor']
    >,
  >(
    input: SchemaInputForInfiniteQuery<TInputSchema>,
    options: OptionalUndefined<
      SetOptional<
        UseInfiniteQueryOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          USelectData,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey<'infinite', Omit<SchemaInput<TInputSchema>, 'cursor'>>,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryFn' | 'queryKey'
      >
    >,
  ) => UseInfiniteQueryResult<USelectData, unknown>

  useSuspenseQuery: <USelectData = SchemaOutput<TOutputSchema, THandlerOutput>>(
    input: SchemaInput<TInputSchema>,
    options?: SetOptional<
      UseSuspenseQueryOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        USelectData,
        QueryKey<'query', SchemaInput<TInputSchema>>
      >,
      'queryFn' | 'queryKey'
    >,
  ) => UseSuspenseQueryResult<USelectData, unknown>
  useSuspenseInfiniteQuery: <
    USelectData = InfiniteData<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      SchemaInput<TInputSchema>['cursor']
    >,
  >(
    input: SchemaInputForInfiniteQuery<TInputSchema>,
    options: OptionalUndefined<
      SetOptional<
        UseSuspenseInfiniteQueryOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          USelectData,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey<'infinite', Omit<SchemaInput<TInputSchema>, 'cursor'>>,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryFn' | 'queryKey'
      >
    >,
  ) => UseSuspenseInfiniteQueryResult<USelectData, unknown>

  usePrefetchQuery: (
    input: SchemaInput<TInputSchema>,
    options?: FetchQueryOptions<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      unknown,
      SchemaOutput<TOutputSchema, THandlerOutput>,
      QueryKey<'query', SchemaInput<TInputSchema>>
    >,
  ) => void
  usePrefetchInfiniteQuery: (
    input: SchemaInputForInfiniteQuery<TInputSchema>,
    options: PartialOnUndefinedDeep<
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
  ) => void

  useMutation: (
    options?: SetOptional<
      UseMutationOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaInput<TInputSchema>,
        unknown
      >,
      'mutationFn' | 'mutationKey'
    >,
  ) => UseMutationResult<
    SchemaOutput<TOutputSchema, THandlerOutput>,
    unknown,
    SchemaInput<TInputSchema>,
    unknown
  >
}

export interface CreateProcedureHooksOptions {
  context: ORPCContext<any>

  /**
   * The path of the procedure on server.
   *
   * @internal
   */
  path: string[]
}

export function createProcedureHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateProcedureHooksOptions,
): ProcedureHooks<TInputSchema, TOutputSchema, THandlerOutput> {
  return {
    [orpcPathSymbol as any]: options.path,

    useQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, { input, type: 'query' }),
          queryFn: () => client(input),
          ...options_,
        },
        context.queryClient,
      )
    },
    useInfiniteQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useInfiniteQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: 'infinite',
          }),
          queryFn: ({ pageParam }) => client({ ...input, cursor: pageParam }),
          ...(options_ as any),
        },
        context.queryClient,
      )
    },

    useSuspenseQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useSuspenseQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, { input, type: 'query' }),
          queryFn: () => client(input),
          ...options_,
        },
        context.queryClient,
      )
    },
    useSuspenseInfiniteQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useSuspenseInfiniteQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: 'infinite',
          }),
          queryFn: ({ pageParam }) => client({ ...input, cursor: pageParam }),
          ...(options_ as any),
        },
        context.queryClient,
      )
    },

    usePrefetchQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return usePrefetchQuery({
        queryKey: getQueryKeyFromPath(options.path, { input, type: 'query' }),
        queryFn: () => client(input),
        ...options_,
      })
    },
    usePrefetchInfiniteQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return usePrefetchInfiniteQuery({
        queryKey: getQueryKeyFromPath(options.path, {
          input,
          type: 'infinite',
        }),
        queryFn: ({ pageParam }) => client({ ...input, cursor: pageParam }),
        ...(options_ as any),
      })
    },

    useMutation(options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useMutation(
        {
          mutationKey: getMutationKeyFromPath(options.path),
          mutationFn: (input) => client(input),
          ...options_,
        },
        context.queryClient,
      )
    },
  }
}
