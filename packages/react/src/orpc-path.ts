import type { ProcedureHooks } from './procedure-hooks'
import type {
  ORPCHooksWithContractRouter,
  ORPCHooksWithRouter,
} from './react-hooks'

export const orpcPathSymbol = Symbol('orpcPathSymbol')

export function getORPCPath(
  orpc:
    | ORPCHooksWithContractRouter<any>
    | ORPCHooksWithRouter<any>
    | ProcedureHooks<any, any, any>,
): string[] {
  const val = Reflect.get(orpc, orpcPathSymbol)

  if (!Array.isArray(val)) {
    throw new Error(
      'orpcPathSymbol is not implemented, please use getORPCPath with correct instance.',
    )
  }

  return val
}
