import type { Middleware } from './middleware'
import type { RouterWithContract } from './router'
import type { LazyRouter } from './router-lazy'
import type { Context } from './types'
import {
  type ContractProcedure,
  type ContractRouter,
  isContractProcedure,
} from '@orpc/contract'
import { isProcedure } from './procedure'
import { ProcedureImplementer } from './procedure-implementer'
import { createLazyProcedureOrLazyRouter } from './router-lazy'

export class RouterImplementer<
  TContext extends Context,
  TContract extends ContractRouter,
> {
  constructor(
    public zz$ri: {
      contract: TContract
    },
  ) {}

  router(
    router: RouterWithContract<TContext, TContract>,
  ): RouterWithContract<TContext, TContract> {
    assertRouterImplementation(this.zz$ri.contract, router)

    return router
  }

  lazy(
    load: () => Promise<{ default: RouterWithContract<TContext, TContract> }>,
  ): LazyRouter<RouterWithContract<TContext, TContract>> {
    return createLazyProcedureOrLazyRouter({
      load: async () => (await load()).default,
    }) as any
  }
}

export type ChainedRouterImplementer<
  TContext extends Context,
  TContract extends ContractRouter,
  TExtraContext extends Context,
> = {
  [K in keyof TContract]: TContract[K] extends ContractProcedure<
    infer UInputSchema,
    infer UOutputSchema
  >
    ? ProcedureImplementer<TContext, TExtraContext, UInputSchema, UOutputSchema>
    : TContract[K] extends ContractRouter
      ? ChainedRouterImplementer<TContext, TContract[K], TExtraContext>
      : never
} & RouterImplementer<TContext, TContract>

export function chainRouterImplementer<
  TContext extends Context,
  TContract extends ContractRouter,
  TExtraContext extends Context,
>(
  contract: TContract,
  middlewares?: Middleware<any, any, any, any>[],
): ChainedRouterImplementer<TContext, TContract, TExtraContext> {
  const result: Record<string, unknown> = {}

  for (const key in contract) {
    const item = contract[key]

    if (isContractProcedure(item)) {
      result[key] = new ProcedureImplementer({
        contract: item,
        middlewares,
      })
    }
    else {
      result[key] = chainRouterImplementer(item as ContractRouter, middlewares)
    }
  }

  const implementer = new RouterImplementer({ contract })

  return Object.assign(implementer, result) as any
}

export function assertRouterImplementation(
  contract: ContractRouter,
  router: RouterWithContract<any, any>,
  path: string[] = [],
): void {
  for (const key in contract) {
    const currentPath = [...path, key]
    const contractItem = contract[key]
    const routerItem = router[key]

    if (!routerItem) {
      throw new Error(
        `Missing implementation for procedure at [${currentPath.join('.')}]`,
      )
    }

    if (isContractProcedure(contractItem)) {
      if (isProcedure(routerItem)) {
        if (routerItem.zz$p.contract !== contractItem) {
          throw new Error(
            `Mismatch implementation for procedure at [${currentPath.join('.')}]`,
          )
        }
      }
      else {
        throw new Error(
          `Mismatch implementation for procedure at [${currentPath.join('.')}]`,
        )
      }
    }
    else {
      assertRouterImplementation(
        contractItem as ContractRouter,
        routerItem as any,
        currentPath,
      )
    }
  }
}
