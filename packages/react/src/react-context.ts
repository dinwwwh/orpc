import type {
  RouterClientWithContractRouter,
  RouterClientWithRouter,
} from '@orpc/client'
import type { ContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import type { QueryClient } from '@tanstack/react-query'
import { type Context, createContext, useContext } from 'react'

export interface ORPCContextValue<
  TRouter extends ContractRouter | Router<any>,
> {
  client: TRouter extends ContractRouter
    ? RouterClientWithContractRouter<TRouter>
    : TRouter extends Router<any>
      ? RouterClientWithRouter<TRouter>
      : never
  queryClient: QueryClient
}

export type ORPCContext<TRouter extends ContractRouter | Router<any>> = Context<
  ORPCContextValue<TRouter> | undefined
>

export function createORPCContext<
  TRouter extends ContractRouter | Router<any>,
>(): ORPCContext<TRouter> {
  return createContext(undefined as any)
}

export function useORPCContext<TRouter extends ContractRouter | Router<any>>(
  context: ORPCContext<TRouter>,
): ORPCContextValue<TRouter> {
  const value = useContext(context)

  if (!value) {
    throw new Error(
      'useORPCContext must be used within a <orpc.Provider>, please see the docs',
    )
  }

  return value
}
