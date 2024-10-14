import type { ProcedureClient } from '@orpc/client'
import type { Schema, SchemaOutput } from '@orpc/contract'
import type { QueryClient } from '@tanstack/react-query'

export interface ProcedureUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  fetch: any
}

export interface CreateProcedureUtilsOptions<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  client: ProcedureClient<TInputSchema, TOutputSchema, THandlerOutput>
  queryClient: QueryClient
}

export function createProcedureUtils<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateProcedureUtilsOptions<
    TInputSchema,
    TOutputSchema,
    THandlerOutput
  >,
): ProcedureUtils<TInputSchema, TOutputSchema, THandlerOutput> {
  // TODO
  return {} as any
}
