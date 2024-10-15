import type { SchemaInput } from '@orpc/contract'
import type { PartialDeep } from 'type-fest'
import type { ProcedureHooks } from './procedure-hooks'
import type {
  ORPCHooksWithContractRouter,
  ORPCHooksWithRouter,
} from './react-hooks'

export type QueryType = 'query' | 'infinite' | undefined
export type QueryKey<TQueryType extends QueryType, TInput> = [
  string[],
  TQueryType extends undefined
    ? { type?: QueryType }
    : { type: TQueryType } & TInput extends undefined
      ? { input?: unknown }
      : { input: TInput },
]

export type MutationKey = [string[]]

export interface GetQueryKeyOptions<TQueryType extends QueryType, TInput> {
  input?: TInput
  type?: TQueryType
}

export function getQueryKey<
  T extends
    | ORPCHooksWithContractRouter<any>
    | ORPCHooksWithRouter<any>
    | ProcedureHooks<any, any, any>,
  TQueryType extends QueryType = undefined,
  TInput extends
    | (T extends ProcedureHooks<infer UInputSchema, any, any>
        ? PartialDeep<SchemaInput<UInputSchema>>
        : unknown)
    | undefined = undefined,
>(
  orpc: T,
  options?: GetQueryKeyOptions<TQueryType, TInput>,
): QueryKey<TQueryType, TInput> {
  const path = ['todo']
  return getQueryKeyFromPath(path, options)
}

export function getQueryKeyFromPath<
  TQueryType extends QueryType = undefined,
  TInput = unknown,
>(
  path: string[],
  options?: GetQueryKeyOptions<TQueryType, TInput>,
): QueryKey<TQueryType, TInput> {
  const withInput =
    options?.input !== undefined ? { input: options?.input } : {}
  const withType = options?.type !== undefined ? { type: options?.type } : {}

  return [
    path,
    {
      ...withInput,
      ...withType,
    } as any,
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
