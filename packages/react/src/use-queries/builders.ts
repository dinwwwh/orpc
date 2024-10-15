import type {
  RouterClientWithContractRouter,
  RouterClientWithRouter,
} from '@orpc/client'
import type {
  ContractProcedure,
  ContractRouter,
  SchemaOutput,
} from '@orpc/contract'
import type { Procedure, Router } from '@orpc/server'
import type {} from '@tanstack/react-query'
import { type UseQueriesBuilder, createUseQueriesBuilder } from './builder'

export type UseQueriesBuildersWithContractRouter<
  TRouter extends ContractRouter,
> = {
  [K in keyof TRouter]: TRouter[K] extends ContractProcedure<
    infer UInputSchema,
    infer UOutputSchema
  >
    ? UseQueriesBuilder<
        UInputSchema,
        UOutputSchema,
        SchemaOutput<UOutputSchema>
      >
    : TRouter[K] extends ContractRouter
      ? UseQueriesBuildersWithContractRouter<TRouter[K]>
      : never
}

export type UseQueriesBuildersWithRouter<TRouter extends Router<any>> = {
  [K in keyof TRouter]: TRouter[K] extends Procedure<
    any,
    any,
    infer UInputSchema,
    infer UOutputSchema,
    infer UHandlerOutput
  >
    ? UseQueriesBuilder<UInputSchema, UOutputSchema, UHandlerOutput>
    : TRouter[K] extends Router<any>
      ? UseQueriesBuildersWithRouter<TRouter[K]>
      : never
}

export interface CreateUseQueriesBuildersOptions<
  TRouter extends Router<any> | ContractRouter,
> {
  client: TRouter extends Router<any>
    ? RouterClientWithRouter<TRouter>
    : TRouter extends ContractRouter
      ? RouterClientWithContractRouter<TRouter>
      : never

  /**
   * The path of router on server
   */
  path?: string[]
}

export function createUseQueriesBuilders<
  TRouter extends Router<any> | ContractRouter,
>(
  options: CreateUseQueriesBuildersOptions<TRouter>,
): TRouter extends Router<any>
  ? UseQueriesBuildersWithRouter<TRouter>
  : TRouter extends ContractRouter
    ? UseQueriesBuildersWithContractRouter<TRouter>
    : never {
  const path = options.path ?? []
  const client = options.client as any

  /**
   * For sure root is not procedure so do not create builder on root
   */
  const builder = path.length ? createUseQueriesBuilder({ client, path }) : {}

  return new Proxy(builder, {
    get(target, key) {
      const value = Reflect.get(target, key)

      if (typeof key !== 'string') {
        return value
      }

      const nextBuilders = createUseQueriesBuilders({
        client: client[key],
        path: [...path, key],
      })

      if (typeof value !== 'function') {
        return nextBuilders
      }

      return new Proxy(value, {
        get(_, key) {
          return Reflect.get(nextBuilders, key)
        },
      })
    },
  }) as any
}
