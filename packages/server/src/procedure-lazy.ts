import type { ANY_PROCEDURE, Procedure } from './procedure'
import { createProcedureCaller, type ProcedureCaller } from './procedure-caller'

export const LAZY_PROCEDURE_LOADER_SYMBOL: unique symbol = Symbol('ORPC_LAZY_PROCEDURE_LOADER')

export interface LazyProcedure<T extends ANY_PROCEDURE> {
  [LAZY_PROCEDURE_LOADER_SYMBOL]: () => Promise<T>
}

export type ANY_LAZY_PROCEDURE = LazyProcedure<ANY_PROCEDURE>

export function createLazyProcedure<T extends ANY_PROCEDURE>(
  loader: () => Promise<T>,
): LazyProcedure<T> {
  return {
    [LAZY_PROCEDURE_LOADER_SYMBOL]: loader,
  }
}

export function isLazyProcedure(item: unknown): item is ANY_LAZY_PROCEDURE {
  return (
    (typeof item === 'object' || typeof item === 'function')
    && item !== null
    && LAZY_PROCEDURE_LOADER_SYMBOL in item
    && typeof item[LAZY_PROCEDURE_LOADER_SYMBOL] === 'function'
  )
}

export type DecoratedLazyProcedure<T extends ANY_PROCEDURE> = LazyProcedure<T> & (
  T extends Procedure<infer UContext, any, any, any, any>
    ? undefined extends UContext
      ? ProcedureCaller<T>
      : unknown
    : never
)

export function decorateLazyProcedure<T extends ANY_PROCEDURE>(lazy: LazyProcedure<T>): DecoratedLazyProcedure<T> {
  const caller = createProcedureCaller({
    procedure: lazy,
    context: undefined as any,
  })

  return Object.assign(caller, lazy) as any
}
