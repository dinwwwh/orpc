import type { ProcedureClient } from '@orpc/client'
import type { Schema, SchemaOutput } from '@orpc/contract'
import type { QueryClient } from '@tanstack/react-query'

export interface GeneralUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  invalidateQuery: any
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
  // TODO
  return {} as any
}
