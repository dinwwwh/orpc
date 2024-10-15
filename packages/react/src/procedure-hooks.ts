import type {
  OptionalUndefined,
  Schema,
  SchemaInput,
  SchemaOutput,
} from '@orpc/contract'
import {
  type InfiniteData,
  type OmitKeyof,
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
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  type QueryKey,
  getMutationKeyFromPath,
  getQueryKeyFromPath,
} from './key'
import { type ORPCContext, useORPCContext } from './react-context'
import { get } from './utils'

export interface ProcedureHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  useQuery: (
    input: SchemaInput<TInputSchema>,
    options?: OmitKeyof<
      UseQueryOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaOutput<TOutputSchema, THandlerOutput>,
        QueryKey
      >,
      'queryFn' | 'queryKey'
    >,
  ) => UseQueryResult<SchemaOutput<TOutputSchema, THandlerOutput>, unknown>
  useInfiniteQuery: (
    options: OptionalUndefined<
      OmitKeyof<
        UseInfiniteQueryOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>>,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryFn' | 'queryKey'
      >
    > & {
      input: SchemaInput<TInputSchema>
    },
  ) => UseInfiniteQueryResult<
    InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>>,
    unknown
  >

  useSuspenseQuery: (
    input: SchemaInput<TInputSchema>,
    options?: OmitKeyof<
      UseSuspenseQueryOptions<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaOutput<TOutputSchema, THandlerOutput>,
        QueryKey
      >,
      'queryFn' | 'queryKey'
    >,
  ) => UseSuspenseQueryResult<
    SchemaOutput<TOutputSchema, THandlerOutput>,
    unknown
  >
  useSuspenseInfiniteQuery: (
    options: OptionalUndefined<
      OmitKeyof<
        UseSuspenseInfiniteQueryOptions<
          SchemaOutput<TOutputSchema, THandlerOutput>,
          unknown,
          InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>>,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          QueryKey,
          SchemaInput<TInputSchema>['cursor']
        >,
        'queryFn' | 'queryKey'
      >
    > & {
      input: SchemaInput<TInputSchema> & Record<string | number | symbol, any>
    },
  ) => UseSuspenseInfiniteQueryResult<
    InfiniteData<SchemaOutput<TOutputSchema, THandlerOutput>>,
    unknown
  >

  useMutation: (
    options?: OmitKeyof<
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
    useQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, { input }),
          queryFn: () => client(input),
          ...options_,
        },
        context.queryClient,
      )
    },
    useInfiniteQuery(options_) {
      const { input, ...rest } = options_
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useInfiniteQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: 'infinite',
          }),
          queryFn: ({ pageParam }) => client({ ...input, cursor: pageParam }),
          ...(rest as any),
        },
        context.queryClient,
      )
    },

    useSuspenseQuery(input, options_) {
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useSuspenseQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, { input }),
          queryFn: () => client(input),
          ...options_,
        },
        context.queryClient,
      )
    },
    useSuspenseInfiniteQuery(options_) {
      const { input, ...rest } = options_
      const context = useORPCContext(options.context)
      const client = get(context.client, options.path) as any
      return useSuspenseInfiniteQuery(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: 'infinite',
          }),
          queryFn: ({ pageParam }) => client({ ...input, cursor: pageParam }),
          ...(rest as any),
        },
        context.queryClient,
      )
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
