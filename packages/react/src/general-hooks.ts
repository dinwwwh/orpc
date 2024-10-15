import type { Schema, SchemaInput, SchemaOutput } from '@orpc/contract'
import {
  type Mutation,
  type MutationFilters,
  type MutationState,
  type OmitKeyof,
  type QueryFilters,
  useIsFetching,
  useIsMutating,
  useMutationState,
} from '@tanstack/react-query'
import {
  type QueryType,
  getMutationKeyFromPath,
  getQueryKeyFromPath,
} from './key'
import { type ORPCContext, useORPCContext } from './react-context'

export interface GeneralHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  useIsFetching: (
    input?: SchemaInput<TInputSchema>,
    filers?: OmitKeyof<QueryFilters, 'queryKey'> & { type?: QueryType },
  ) => number
  useIsMutating: (filters?: OmitKeyof<MutationFilters, 'mutationKey'>) => number

  useMutationState: <
    UResult = MutationState<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      unknown,
      SchemaInput<TInputSchema>,
      unknown
    >,
  >(options?: {
    filters?: OmitKeyof<MutationFilters, 'mutationKey'>
    select?: (
      mutation: Mutation<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        unknown,
        SchemaInput<TInputSchema>,
        unknown
      >,
    ) => UResult
  }) => UResult[]
}

export interface CreateGeneralHooksOptions {
  context: ORPCContext<any>

  /**
   * The path of the router or procedure on server.
   *
   * @internal
   */
  path: string[]
}

export function createGeneralHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateGeneralHooksOptions,
): GeneralHooks<TInputSchema, TOutputSchema, THandlerOutput> {
  return {
    useIsFetching(input, filters) {
      const { type, ...rest } = filters ?? {}
      const context = useORPCContext(options.context)
      return useIsFetching(
        {
          queryKey: getQueryKeyFromPath(options.path, { input, type }),
          ...rest,
        },
        context.queryClient,
      )
    },
    useIsMutating(filters) {
      const context = useORPCContext(options.context)
      return useIsMutating(
        { mutationKey: getMutationKeyFromPath(options.path), ...filters },
        context.queryClient,
      )
    },

    useMutationState(options_) {
      const context = useORPCContext(options.context)
      return useMutationState(
        {
          ...(options_ as any),
          filters: {
            mutationKey: getMutationKeyFromPath(options.path),
            ...options_?.filters,
          },
        },
        context.queryClient,
      )
    },
  }
}
