import type { SchemaInput } from '@orpc/contract'
import type { MutationKey, QueryKey } from '@tanstack/react-query'
import type { PartialDeep } from 'type-fest'
import { getORPCPath } from './orpc-path'
import type { ProcedureHooks } from './procedure-hooks'
import type {
  ORPCHooksWithContractRouter,
  ORPCHooksWithRouter,
} from './react-hooks'

export type QueryType = 'query' | 'infinite' | undefined

export interface GetQueryKeyOptions<TInput> {
  input?: TInput
  type?: QueryType
}

export function getQueryKey<
  T extends
    | ORPCHooksWithContractRouter<any>
    | ORPCHooksWithRouter<any>
    | ProcedureHooks<any, any, any>,
>(
  orpc: T,
  options?: GetQueryKeyOptions<
    T extends ProcedureHooks<infer UInputSchema, any, any>
      ? PartialDeep<SchemaInput<UInputSchema>>
      : unknown
  >,
): QueryKey {
  const path = getORPCPath(orpc)
  return getQueryKeyFromPath(path, options)
}

export function getQueryKeyFromPath(
  path: string[],
  options?: GetQueryKeyOptions<unknown>,
): QueryKey {
  const withInput =
    options?.input !== undefined ? { input: options?.input } : {}
  const withType = options?.type !== undefined ? { type: options?.type } : {}

  return [
    path,
    {
      ...withInput,
      ...withType,
    },
  ]
}

export function getMutationKey<
  T extends
    | ORPCHooksWithContractRouter<any>
    | ORPCHooksWithRouter<any>
    | ProcedureHooks<any, any, any>,
>(orpc: T): MutationKey {
  const path = getORPCPath(orpc)
  return getMutationKeyFromPath(path)
}

export function getMutationKeyFromPath(path: string[]): MutationKey {
  return [path]
}
