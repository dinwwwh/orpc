import type { SchemaInput } from '@orpc/contract'
import type { ProcedureHooks } from './procedure-hooks'
import type {
  ORPCHooksWithContractRouter,
  ORPCHooksWithRouter,
} from './react-hooks'

export type QueryKey = [string[], { input?: unknown; type?: 'infinite' }]
export type MutationKey = [string[]]

export type QueryType = 'any' | 'infinite'

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
      ? SchemaInput<UInputSchema>
      : unknown
  >,
): QueryKey {
  const path = ['todo']
  return getQueryKeyFromPath(path, options)
}

export function getQueryKeyFromPath(
  path: string[],
  options?: GetQueryKeyOptions<unknown>,
): QueryKey {
  const withInput =
    options?.input !== undefined ? { input: options?.input } : {}
  const withType =
    options?.type !== undefined && options?.type !== 'any'
      ? { type: options?.type }
      : {}

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
  const path = ['todo']
  return getMutationKeyFromPath(path)
}

export function getMutationKeyFromPath(path: string[]): MutationKey {
  return [path]
}
