import type {} from '@orpc/contract'
import type {
  InfiniteData,
  InvalidateQueryFilters,
  QueryFilters,
} from '@tanstack/react-query'
import type { QueryKey, QueryType } from './key'

export interface ORPCQueryFilters<TQueryType extends QueryType, TFilterInput>
  extends QueryFilters {
  /**
   * Custom queries matching this query key
   */
  queryKey?: ReadonlyArray<unknown>

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

export interface ORPCInvalidateQueryFilters<
  TQueryType extends QueryType,
  TFilterInput,
> extends InvalidateQueryFilters {
  /**
   * Custom queries matching this query key
   */
  queryKey?: ReadonlyArray<unknown>

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

export type ORPCQueryData<
  TQueryType extends QueryType,
  TOutput,
> = TQueryType extends 'infinite'
  ? InfiniteData<TOutput>
  : TQueryType extends 'query'
    ? TOutput
    : InfiniteData<TOutput> | TOutput

export type ORPCQueriesData<
  TQueryType extends QueryType,
  TFilterInput,
  TOutput,
> = TQueryType extends 'infinite'
  ? [QueryKey<TQueryType, TFilterInput>, InfiniteData<TOutput> | undefined]
  : TQueryType extends 'query'
    ? [QueryKey<TQueryType, TFilterInput>, TOutput | undefined]
    :
        | [
            QueryKey<TQueryType, TFilterInput>,
            InfiniteData<TOutput> | undefined,
          ]
        | [QueryKey<TQueryType, TFilterInput>, TOutput | undefined]
