import type {
  InvalidateQueryFilters,
  QueryFilters,
} from '@tanstack/react-query'
import type { SetOptional } from 'type-fest'
import type { QueryType } from './tanstack-key'

export interface ORPCAdditionalQueryFilters<TFilterInput> {
  /**
   * The type of the query. useQuery=query, useInfiniteQuery=infinite
   * If not specified, it will match all types.
   */
  queryType?: QueryType

  /**
   * The input of the query. If not specified, it will match all inputs.
   */
  input?: TFilterInput
}

export interface ORPCQueryFilters<TFilterInput>
  extends SetOptional<QueryFilters, 'queryKey'>,
    ORPCAdditionalQueryFilters<TFilterInput> {}

export interface ORPCInvalidateQueryFilters<TFilterInput>
  extends SetOptional<InvalidateQueryFilters, 'queryKey'>,
    ORPCAdditionalQueryFilters<TFilterInput> {}
