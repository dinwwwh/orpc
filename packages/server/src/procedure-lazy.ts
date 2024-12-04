import type { Procedure } from './procedure'
import { createProcedureCaller, type ProcedureCaller } from './procedure-caller'

export const LAZY_PROCEDURE_LOADER_SYMBOL: unique symbol = Symbol('ORPC_LAZY_PROCEDURE_LOADER')

export interface LazyProcedure<T extends Procedure<any, any, any, any, any>> {
  [LAZY_PROCEDURE_LOADER_SYMBOL]: () => Promise<T>
}

export type DecoratedLazyProcedure<T extends Procedure<any, any, any, any, any>> = LazyProcedure<T> & (
  T extends Procedure<infer UContext, any, any, any, any>
    ? undefined extends UContext
      ? ProcedureCaller<T>
      : unknown
    : never
)

export function decorateLazyProcedure<T extends Procedure<any, any, any, any, any>>(
  loader: () => Promise<T>,
): DecoratedLazyProcedure<T> {
  const lazyProcedure: LazyProcedure<T> = {
    [LAZY_PROCEDURE_LOADER_SYMBOL]: loader,
  }

  const caller = createProcedureCaller({
    procedure: lazyProcedure,
    context: undefined as any,
  })

  return Object.assign(caller, lazyProcedure) as any
}

export type ANY_LAZY_PROCEDURE = LazyProcedure<Procedure<any, any, any, any, any>>

export function isLazyProcedure(item: unknown): item is ANY_LAZY_PROCEDURE {
  return (
    (typeof item === 'object' || typeof item === 'function')
    && item !== null
    && LAZY_PROCEDURE_LOADER_SYMBOL in item
    && typeof item[LAZY_PROCEDURE_LOADER_SYMBOL] === 'function'
  )
}
