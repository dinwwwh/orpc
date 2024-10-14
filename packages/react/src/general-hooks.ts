import type { Schema, SchemaOutput } from '@orpc/contract'
import type { ORPCContext } from './react-context'

export interface GeneralHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
> {
  useIsMutating: any
}

export interface CreateGeneralHooksOptions {
  context: ORPCContext<any>

  /**
   * The path of the router or procedure on server.
   *
   * @internal
   */
  path: string[]
}

export function createGeneralHooks<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  THandlerOutput extends SchemaOutput<TOutputSchema>,
>(
  options: CreateGeneralHooksOptions,
): GeneralHooks<TInputSchema, TOutputSchema, THandlerOutput> {
  // TODO
  return {} as any
}
