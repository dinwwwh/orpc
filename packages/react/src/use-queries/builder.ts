import type { ProcedureClient } from '@orpc/client'
import type { Schema, SchemaInput, SchemaOutput } from '@orpc/contract'
import type {} from '@orpc/server'
import type {
  DefaultError,
  OmitKeyof,
  QueriesPlaceholderDataFunction,
  QueryKey,
  UseQueryOptions,
} from '@tanstack/react-query'
import type { SetOptional } from 'type-fest'
import { getQueryKeyFromPath } from '../tanstack-key'

type UseQueryOptionsForUseQueries<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = OmitKeyof<
  UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'placeholderData'
> & {
  placeholderData?: TQueryFnData | QueriesPlaceholderDataFunction<TQueryFnData>
}

export interface UseQueriesBuilder<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  (
    input: SchemaInput<TInputSchema>,
    options?: SetOptional<
      UseQueryOptionsForUseQueries<SchemaOutput<TOutputSchema, THandlerOutput>>,
      'queryFn' | 'queryKey'
    >,
  ): UseQueryOptionsForUseQueries<SchemaOutput<TOutputSchema, THandlerOutput>>
}

export interface CreateUseQueriesBuilderOptions<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  client: ProcedureClient<TInputSchema, TOutputSchema, THandlerOutput>

  /**
   * The path of procedure on server
   */
  path: string[]
}

export function createUseQueriesBuilder<
  TInputSchema extends Schema = undefined,
  TOutputSchema extends Schema = undefined,
  THandlerOutput extends
    SchemaOutput<TOutputSchema> = SchemaOutput<TOutputSchema>,
>(
  options: CreateUseQueriesBuilderOptions<
    TInputSchema,
    TOutputSchema,
    THandlerOutput
  >,
): UseQueriesBuilder<TInputSchema, TOutputSchema, THandlerOutput> {
  return (input, options_) => {
    return {
      queryKey: getQueryKeyFromPath(options.path, { input, type: 'query' }),
      queryFn: () => options.client(input),
      ...options_,
    }
  }
}
