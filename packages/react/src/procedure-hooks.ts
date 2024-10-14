import type { Schema, SchemaOutput } from '@orpc/contract'
import type { ORPCContext } from './react-context'

export interface ProcedureHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  useQuery: any
}

export interface CreateProcedureHooksOptions {
  context: ORPCContext<any>

  /**
   * The path of the procedure on server.
   *
   * @internal
   */
  path: string[]
}

export function createProcedureHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateProcedureHooksOptions,
): ProcedureHooks<TInputSchema, TOutputSchema, THandlerOutput> {
  // TODO
  return {} as any
}
