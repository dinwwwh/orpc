import type {} from '@orpc/client'
import type {
  ContractProcedure,
  ContractRouter,
  SchemaOutput,
} from '@orpc/contract'
import type { Procedure, Router } from '@orpc/server'
import { type GeneralUtils, createGeneralUtils } from './general-utils'
import { type ProcedureUtils, createProcedureUtils } from './procedure-utils'
import type { ORPCContextValue } from './react-context'

export type ORPCUtilsWithContractRouter<TRouter extends ContractRouter> = {
  [K in keyof TRouter]: TRouter[K] extends ContractProcedure<
    infer UInputSchema,
    infer UOutputSchema
  >
    ? ProcedureUtils<UInputSchema, UOutputSchema, SchemaOutput<UOutputSchema>> &
        GeneralUtils<UInputSchema, UOutputSchema, SchemaOutput<UOutputSchema>>
    : TRouter[K] extends ContractRouter
      ? ORPCUtilsWithContractRouter<TRouter[K]>
      : never
} & GeneralUtils<undefined, undefined, unknown>

export type ORPCUtilsWithRouter<TRouter extends Router<any>> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<
    any,
    any,
    infer UInputSchema,
    infer UOutputSchema,
    infer UHandlerOutput
  >
    ? ProcedureUtils<UInputSchema, UOutputSchema, UHandlerOutput> &
        GeneralUtils<UInputSchema, UOutputSchema, UHandlerOutput>
    : TRouter[K] extends Router<any>
      ? ORPCUtilsWithRouter<TRouter[K]>
      : never
} & GeneralUtils<undefined, undefined, unknown>

export interface CreateORPCUtilsOptions<
  TRouter extends ContractRouter | Router<any>,
> {
  contextValue: ORPCContextValue<TRouter>

  /**
   * The path of the router.
   *
   * @internal
   */
  path?: string[]
}

export function createORPCUtils<TRouter extends ContractRouter | Router<any>>(
  options: CreateORPCUtilsOptions<TRouter>,
): TRouter extends Router<any>
  ? ORPCUtilsWithRouter<TRouter>
  : TRouter extends ContractRouter
    ? ORPCUtilsWithContractRouter<TRouter>
    : never {
  const path = options.path ?? []
  const client = options.contextValue.client as any

  const generalUtils = createGeneralUtils({
    client,
    queryClient: options.contextValue.queryClient,
    path,
  })

  // for sure root is not procedure, so do not it procedure utils on root
  const procedureUtils = path.length
    ? createProcedureUtils({
        client,
        queryClient: options.contextValue.queryClient,
        path,
      })
    : {}

  return new Proxy(
    {
      ...generalUtils,
      ...procedureUtils,
    },
    {
      get(target, key) {
        const value = Reflect.get(target, key)

        if (typeof key !== 'string') {
          return value
        }

        const nextUtils = createORPCUtils({
          ...options,
          contextValue: {
            ...options.contextValue,
            client: client[key],
          },
          path: [...path, key],
        })

        if (typeof value !== 'function') {
          return nextUtils
        }

        return new Proxy(value, {
          get(_, key) {
            return Reflect.get(nextUtils, key)
          },
        })
      },
    },
  ) as any
}
