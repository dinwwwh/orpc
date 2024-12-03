import type { Schema, SchemaOutput } from '@orpc/contract'
import type { Middleware } from './middleware'
import type { DecoratedProcedure, Procedure } from './procedure'
import type { Context } from './types'
import { decorateProcedure } from './procedure'
import { createProcedureCaller, type ProcedureCaller } from './procedure-caller'

export const LAZY_PROCEDURE_SYMBOL: unique symbol = Symbol('ORPC_LAZY_PROCEDURE')

export interface LazyProcedure<
  TContext extends Context,
  TExtraContext extends Context,
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  TFuncOutput extends SchemaOutput<TOutputSchema>,
> {
  [LAZY_PROCEDURE_SYMBOL]: {
    load: () => Promise<DecoratedProcedure<TContext, TExtraContext, TInputSchema, TOutputSchema, TFuncOutput>>
  }
}

export type DecoratedLazyProcedure<
  TContext extends Context,
  TExtraContext extends Context,
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  TFuncOutput extends SchemaOutput<TOutputSchema>,
> = LazyProcedure<TContext, TExtraContext, TInputSchema, TOutputSchema, TFuncOutput> & (
    undefined extends TContext
      ? ProcedureCaller<Procedure<
        TContext,
        TExtraContext,
        TInputSchema,
        TOutputSchema,
        TFuncOutput
      >>
      : unknown
    )

export interface DecorateLazyProcedureOptions<
  TContext extends Context,
  TExtraContext extends Context,
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  TFuncOutput extends SchemaOutput<TOutputSchema>,
> {
  load: () => Promise<Procedure<TContext, TExtraContext, TInputSchema, TOutputSchema, TFuncOutput>>
  middlewares?: Middleware<any, any, any, any>[]
}

export function decorateLazyProcedure<
  TContext extends Context,
  TExtraContext extends Context,
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
  TFuncOutput extends SchemaOutput<TOutputSchema>,
>(
  options: DecorateLazyProcedureOptions<TContext, TExtraContext, TInputSchema, TOutputSchema, TFuncOutput>,
): DecoratedLazyProcedure<TContext, TExtraContext, TInputSchema, TOutputSchema, TFuncOutput> {
  const lazyProcedure: LazyProcedure<TContext, TExtraContext, TInputSchema, TOutputSchema, TFuncOutput> = {
    [LAZY_PROCEDURE_SYMBOL]: {
      load: async () => {
        const procedure = await options.load()

        const lazyMiddlewares = options.middlewares ?? []
        const procedureMiddlewares = procedure.zz$p.middlewares ?? []

        const middlewares = [
          ...lazyMiddlewares,
          ...procedureMiddlewares.filter(
            item => !lazyMiddlewares.includes(item),
          ),
        ]

        return decorateProcedure({
          zz$p: {
            ...procedure.zz$p,
            middlewares,
          },
        })
      },
    },
  }

  const caller = createProcedureCaller({
    procedure: lazyProcedure,
    context: undefined as any,
  })

  return Object.assign(caller, lazyProcedure)
}

export function isLazyProcedure(item: unknown): item is LazyProcedure<any, any, any, any, any> {
  return (typeof item === 'object' || typeof item === 'function')
    && item !== null
    && LAZY_PROCEDURE_SYMBOL in item
    && typeof item[LAZY_PROCEDURE_SYMBOL] === 'object'
    && item[LAZY_PROCEDURE_SYMBOL] !== null
    && 'load' in item[LAZY_PROCEDURE_SYMBOL]
    && typeof item[LAZY_PROCEDURE_SYMBOL].load === 'function'
}
