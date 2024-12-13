import type {
  ContractProcedure,
  ContractRouter,
  SchemaInput,
  SchemaOutput,
} from '@orpc/contract'
import type { ANY_LAZY, DecoratedLazy, Lazy } from './lazy'
import type {
  DecoratedProcedure,
  Procedure,
} from './procedure'

import type { Context } from './types'

export interface Router<TContext extends Context> {
  [k: string]:
    | Procedure<TContext, any, any, any, any>
    | Lazy<Procedure<TContext, any, any, any, any>>
    | Router<TContext>
    | Lazy<Router<TContext>>
}

export type HandledRouter<TRouter extends Router<any>> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<
    infer UContext,
    infer UExtraContext,
    infer UInputSchema,
    infer UOutputSchema,
    infer UFuncOutput
  >
    ? DecoratedProcedure<
      UContext,
      UExtraContext,
      UInputSchema,
      UOutputSchema,
      UFuncOutput
    >
    : TRouter[K] extends ANY_LAZY
      ? DecoratedLazy<TRouter[K]>
      : TRouter[K] extends Router<any>
        ? HandledRouter<TRouter[K]>
        : never
}

export type RouterWithContract<
  TContext extends Context,
  TContract extends ContractRouter,
> = {
  [K in keyof TContract]: TContract[K] extends ContractProcedure<
    infer UInputSchema,
    infer UOutputSchema
  >
    ? Procedure<TContext, any, UInputSchema, UOutputSchema, any> | Lazy<Procedure<TContext, any, UInputSchema, UOutputSchema, any>>
    : TContract[K] extends ContractRouter
      ? RouterWithContract<TContext, TContract[K]>
      : never
}

export type InferRouterInputs<T extends Router<any>> = {
  [K in keyof T]: T[K] extends
  | Procedure<any, any, infer UInputSchema, any, any>
  | Lazy<Procedure<any, any, infer UInputSchema, any, any>>
    ? SchemaInput<UInputSchema>
    : T[K] extends Router<any>
      ? InferRouterInputs<T[K]>
      : never
}

export type InferRouterOutputs<T extends Router<any>> = {
  [K in keyof T]: T[K] extends
  | Procedure<any, any, any, infer UOutputSchema, infer UFuncOutput>
  | Lazy<Procedure<any, any, any, infer UOutputSchema, infer UFuncOutput>>
    ? SchemaOutput<UOutputSchema, UFuncOutput>
    : T[K] extends Router<any>
      ? InferRouterOutputs<T[K]>
      : never
}
