import type { Schema, SchemaInput } from '@orpc/contract'

export type SchemaInputForInfiniteQuery<TInputSchema extends Schema> = Omit<
  SchemaInput<TInputSchema>,
  'cursor'
> &
  (Record<string | number, any> & { cursor?: never })
