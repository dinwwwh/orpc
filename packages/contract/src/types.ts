import type { ZodType, input, output } from 'zod'

export type HTTPPath = `/${string}`
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type HTTPStatus = number

export type Schema = ZodType<any, any, any> | undefined

export type SchemaInput<
  TSchema extends Schema,
  TFallback = unknown,
> = TSchema extends undefined
  ? TFallback
  : TSchema extends ZodType<any, any, any>
    ? input<TSchema>
    : TFallback

export type SchemaOutput<
  TSchema extends Schema,
  TFallback = unknown,
> = TSchema extends undefined
  ? TFallback
  : TSchema extends ZodType<any, any, any>
    ? output<TSchema>
    : TFallback

export type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends <
  G,
>() => G extends B ? 1 : 2
  ? true
  : false
