import type { Schema, SchemaInput, SchemaOutput } from '@orpc/contract'
import {
  type DefaultError,
  type Mutation,
  type MutationFilters,
  type MutationState,
  useIsFetching,
  useIsMutating,
  useMutationState,
} from '@tanstack/react-query'
import type { PartialDeep, SetOptional } from 'type-fest'
import { type ORPCContext, useORPCContext } from './react-context'
import { getMutationKeyFromPath, getQueryKeyFromPath } from './tanstack-key'
import type { ORPCQueryFilters } from './tanstack-query'

export interface GeneralHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  useIsFetching(
    filers?: ORPCQueryFilters<PartialDeep<SchemaInput<TInputSchema>>>,
  ): number
  useIsMutating(filters?: SetOptional<MutationFilters, 'mutationKey'>): number

  useMutationState<
    UResult = MutationState<
      SchemaOutput<TOutputSchema, THandlerOutput>,
      DefaultError,
      SchemaInput<TInputSchema>
    >,
  >(options?: {
    filters?: SetOptional<MutationFilters, 'mutationKey'>
    select?: (
      mutation: Mutation<
        SchemaOutput<TOutputSchema, THandlerOutput>,
        DefaultError,
        SchemaInput<TInputSchema>
      >,
    ) => UResult
  }): UResult[]
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
  TInputSchema extends Schema = undefined,
  TOutputSchema extends Schema = undefined,
  THandlerOutput extends
    SchemaOutput<TOutputSchema> = SchemaOutput<TOutputSchema>,
>(
  options: CreateGeneralHooksOptions,
): GeneralHooks<TInputSchema, TOutputSchema, THandlerOutput> {
  return {
    useIsFetching(filters) {
      const { queryType, input, ...rest } = filters ?? {}
      const context = useORPCContext(options.context)
      return useIsFetching(
        {
          queryKey: getQueryKeyFromPath(options.path, {
            input,
            type: queryType,
          }),
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
