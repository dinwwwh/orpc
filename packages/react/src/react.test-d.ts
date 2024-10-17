import type { SchemaOutput } from '@orpc/contract'
import type { QueryClient } from '@tanstack/react-query'
import {
  ORPCContext,
  type UserFindInputSchema,
  type UserSchema,
  orpc,
  orpcClient,
} from '../tests/orpc'
import type { GeneralHooks } from './general-hooks'
import type { GeneralUtils } from './general-utils'
import type { ProcedureHooks } from './procedure-hooks'
import type { ProcedureUtils } from './procedure-utils'
import { useQueriesFactory } from './use-queries/hook'

describe('useUtils', () => {
  const utils = orpc.useUtils()

  it('router level', () => {
    expectTypeOf(utils).toMatchTypeOf<
      GeneralUtils<undefined, undefined, unknown>
    >()

    expectTypeOf(utils.user).toMatchTypeOf<
      GeneralUtils<undefined, undefined, unknown>
    >()
  })

  it('procedure level', () => {
    expectTypeOf(utils.user.find).toMatchTypeOf<
      GeneralUtils<
        typeof UserFindInputSchema,
        typeof UserSchema,
        SchemaOutput<typeof UserSchema>
      >
    >()

    expectTypeOf(utils.user.find).toMatchTypeOf<
      ProcedureUtils<
        typeof UserFindInputSchema,
        typeof UserSchema,
        SchemaOutput<typeof UserSchema>
      >
    >()
  })
})

it('useContext', () => {
  const context = orpc.useContext()

  expectTypeOf(context.client).toEqualTypeOf(orpcClient)
  expectTypeOf(context.queryClient).toEqualTypeOf<QueryClient>()
})

it('useQueries', () => {
  expectTypeOf(orpc.useQueries).toEqualTypeOf(
    useQueriesFactory({ context: ORPCContext }),
  )
})

describe('hooks', () => {
  it('router level', () => {
    expectTypeOf(orpc).toMatchTypeOf<
      GeneralHooks<undefined, undefined, unknown>
    >()

    expectTypeOf(orpc.user).toMatchTypeOf<
      GeneralHooks<undefined, undefined, unknown>
    >()
  })

  it('procedure level', () => {
    expectTypeOf(orpc.user.find).toMatchTypeOf<
      GeneralHooks<
        typeof UserFindInputSchema,
        typeof UserSchema,
        SchemaOutput<typeof UserSchema>
      >
    >()

    expectTypeOf(orpc.user.find).toMatchTypeOf<
      ProcedureHooks<
        typeof UserFindInputSchema,
        typeof UserSchema,
        SchemaOutput<typeof UserSchema>
      >
    >()
  })
})
