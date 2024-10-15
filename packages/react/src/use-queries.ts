import type {
  ContractProcedure,
  ContractRouter,
  Schema,
  SchemaInput,
  SchemaOutput,
} from '@orpc/contract'
import type { Procedure, Router } from '@orpc/server'
import type { QueriesOptions, QueriesResults } from '@tanstack/react-query'
import type { ORPCContext } from './react-context'

export interface UseQueriesBuilder<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  (
    input?: SchemaInput<TInputSchema>,
  ): QueriesOptions<
    SchemaOutput<TOutputSchema, THandlerOutput>[]
  >[keyof QueriesOptions<SchemaOutput<TOutputSchema, THandlerOutput>[]>]
}

export type UseQueriesBuilderWithContractRouter<
  TRouter extends ContractRouter,
> = {
  [K in keyof TRouter]: TRouter[K] extends ContractProcedure<
    infer UInputSchema,
    infer UOutputSchema
  >
    ? UseQueriesBuilder<
        UInputSchema,
        UOutputSchema,
        SchemaOutput<UOutputSchema>
      >
    : TRouter[K] extends ContractRouter
      ? UseQueriesBuilderWithContractRouter<TRouter[K]>
      : never
}

export type UseQueriesBuilderWithRouter<TRouter extends Router<any>> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<
    any,
    any,
    infer UInputSchema,
    infer UOutputSchema,
    infer UHandlerOutput
  >
    ? UseQueriesBuilder<UInputSchema, UOutputSchema, UHandlerOutput>
    : TRouter[K] extends Router<any>
      ? UseQueriesBuilderWithRouter<TRouter[K]>
      : never
}

export interface UseQueriesWithContractRouter<TRouter extends ContractRouter> {
  <T extends Array<any>, TCombinedResult = QueriesResults<T>>(
    build: (
      builder: UseQueriesBuilderWithContractRouter<TRouter>,
    ) => [...QueriesOptions<T>],
    combine?: (result: QueriesResults<T>) => TCombinedResult,
  ): TCombinedResult
}

export interface UseQueriesWithRouter<TRouter extends Router<any>> {
  <T extends Array<any>, TCombinedResult = QueriesResults<T>>(
    build: (
      builder: UseQueriesBuilderWithRouter<TRouter>,
    ) => [...QueriesOptions<T>],
    combine?: (result: QueriesResults<T>) => TCombinedResult,
  ): TCombinedResult
}

export interface UseQueriesFactoryOptions<
  TRouter extends Router<any> | ContractRouter,
> {
  context: ORPCContext<TRouter>
}

export function useQueriesFactory<TRouter extends Router<any> | ContractRouter>(
  options: UseQueriesFactoryOptions<TRouter>,
): TRouter extends Router<any>
  ? UseQueriesWithRouter<TRouter>
  : TRouter extends ContractRouter
    ? UseQueriesWithContractRouter<TRouter>
    : never {
  return {} as any
}
