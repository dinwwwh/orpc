import type {
  InfiniteData,
  InvalidateQueryFilters,
  QueryFilters,
} from '@tanstack/react-query'
import type { SetOptional } from 'type-fest'
import type { QueryKey, QueryType } from './key'

export interface ORPCAdditionalQueryFilters<
  TQueryType extends QueryType,
  TFilterInput,
> {
  /**
   * The type of the query. useQuery=query, useInfiniteQuery=infinite
   * If not specified, it will match all types.
   */
  queryType?: TQueryType

  /**
   * The input of the query. If not specified, it will match all inputs.
   */
  input?: TFilterInput
}

export interface ORPCQueryFilters<TQueryType extends QueryType, TFilterInput>
  extends SetOptional<QueryFilters, 'queryKey'>,
    ORPCAdditionalQueryFilters<TQueryType, TFilterInput> {}

export interface ORPCInvalidateQueryFilters<
  TQueryType extends QueryType,
  TFilterInput,
> extends SetOptional<InvalidateQueryFilters, 'queryKey'>,
    ORPCAdditionalQueryFilters<TQueryType, TFilterInput> {}

export type ORPCQueryData<
  TQueryType extends QueryType,
  TOutput,
  TCursor,
> = TQueryType extends 'infinite'
  ? InfiniteData<TOutput, TCursor>
  : TQueryType extends 'query'
    ? TOutput
    : InfiniteData<TOutput, TCursor> | TOutput

export type ORPCQueriesData<
  TQueryType extends QueryType,
  TFilterInput,
  TOutput,
  TCursor,
> = TQueryType extends 'infinite'
  ? [
      QueryKey<TQueryType, TFilterInput>,
      InfiniteData<TOutput, TCursor> | undefined,
    ]
  : TQueryType extends 'query'
    ? [QueryKey<TQueryType, TFilterInput>, TOutput | undefined]
    :
        | [
            QueryKey<TQueryType, TFilterInput>,
            InfiniteData<TOutput, TCursor> | undefined,
          ]
        | [QueryKey<TQueryType, TFilterInput>, TOutput | undefined]
