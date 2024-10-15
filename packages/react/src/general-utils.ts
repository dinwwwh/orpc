import type { ProcedureClient } from '@orpc/client'
import type { Schema, SchemaInput, SchemaOutput } from '@orpc/contract'
import type {
  CancelOptions,
  InvalidateOptions,
  MutationFilters,
  OmitKeyof,
  QueryClient,
  QueryFilters,
  RefetchOptions,
  ResetOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/react-query'
import type { PartialDeep } from 'type-fest'
import type { QueryType } from './key'
import type {
  ORPCInvalidateQueryFilters,
  ORPCQueriesData,
  ORPCQueryData,
  ORPCQueryFilters,
} from './tanstack-query'

export interface GeneralUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  getQueriesData: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
  ) => ORPCQueriesData<
    TQueryType,
    TFilterInput,
    SchemaOutput<TOutputSchema, THandlerOutput>,
    SchemaInput<TInputSchema>['cursor']
  >
  setQueriesData: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters: ORPCQueryFilters<TQueryType, TFilterInput>,
    updater: Updater<
      | ORPCQueryData<
          TQueryType,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >
      | undefined,
      | ORPCQueryData<
          TQueryType,
          SchemaOutput<TOutputSchema, THandlerOutput>,
          SchemaInput<TInputSchema>['cursor']
        >
      | undefined
    >,
    options?: SetDataOptions,
  ) => ORPCQueriesData<
    TQueryType,
    TFilterInput,
    SchemaOutput<TOutputSchema, THandlerOutput>,
    SchemaInput<TInputSchema>['cursor']
  >

  invalidateQueries: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCInvalidateQueryFilters<TQueryType, TFilterInput>,
    options?: InvalidateOptions,
  ) => Promise<void>
  refetchQueries: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
    options?: RefetchOptions,
  ) => Promise<void>
  cancelQueries: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
    options?: CancelOptions,
  ) => Promise<void>
  removeQueries: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
  ) => void
  resetQueries: <
    TQueryType extends QueryType = undefined,
    TFilterInput extends
      | PartialDeep<SchemaInput<TInputSchema>>
      | undefined = undefined,
  >(
    filters?: ORPCQueryFilters<TQueryType, TFilterInput>,
    options?: ResetOptions,
  ) => Promise<void>

  isFetching: (
    filters?: OmitKeyof<QueryFilters, 'queryKey'> & { queryType?: QueryType },
  ) => number
  isMutating: (filters?: OmitKeyof<MutationFilters, 'mutationKey'>) => number
}

export interface CreateGeneralUtilsOptions<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  client: ProcedureClient<TInputSchema, TOutputSchema, THandlerOutput>
  queryClient: QueryClient
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
      return options.queryClient.getQueriesData(filters ?? {}) as any
    },
    setQueriesData(filters, updater, options_) {
      return options.queryClient.setQueriesData(
        filters,
        updater,
        options_,
      ) as any
    },

    invalidateQueries(filters, options_) {
      return options.queryClient.invalidateQueries(filters, options_)
    },
    refetchQueries(filters, options_) {
      return options.queryClient.refetchQueries(filters, options_)
    },
    cancelQueries(filters, options_) {
      return options.queryClient.cancelQueries(filters, options_)
    },
    removeQueries(filters) {
      return options.queryClient.removeQueries(filters)
    },
    resetQueries(filters, options_) {
      return options.queryClient.resetQueries(filters, options_)
    },

    isFetching(filters) {
      return options.queryClient.isFetching(filters)
    },
    isMutating(filters) {
      return options.queryClient.isMutating(filters)
    },
  }
}
