import type { SchemaInput, SchemaOutput } from '@orpc/contract'
import type {
  DefaultError,
  Mutation,
  MutationState,
} from '@tanstack/react-query'
import {
  ORPCContext,
  type UserCreateInputSchema,
  type UserFindInputSchema,
  type UserSchema,
} from '../tests/orpc'
import { createGeneralHooks } from './general-hooks'

describe('useIsFetching', () => {
  const hooks = createGeneralHooks<undefined, undefined, unknown>({
    context: ORPCContext,
    path: ['user'],
  })

  const procedureHooks = createGeneralHooks<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'find'],
  })

  it('simple', () => {
    const result = hooks.useIsFetching()
    expectTypeOf(result).toEqualTypeOf<number>()
  })

  it('with filters', () => {
    const result = procedureHooks.useIsFetching({
      input: {},
    })

    expectTypeOf(result).toEqualTypeOf<number>()

    procedureHooks.useIsFetching({
      input: {
        id: '1',
      },
    })

    procedureHooks.useIsFetching({
      input: {
        // @ts-expect-error invalid id
        id: 1,
      },
    })
  })
})

describe('useIsMutating', () => {
  const hooks = createGeneralHooks<undefined, undefined, unknown>({
    context: ORPCContext,
    path: ['user'],
  })

  const procedureHooks = createGeneralHooks<
    typeof UserCreateInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'create'],
  })

  it('simple', () => {
    const result = hooks.useIsMutating()
    expectTypeOf(result).toEqualTypeOf<number>()
  })

  it('with filters', () => {
    const result = procedureHooks.useIsMutating({
      // @ts-expect-error input is now allowed on mutation
      input: {},
    })
  })
})

describe('useMutationState', () => {
  const hooks = createGeneralHooks<undefined, undefined, unknown>({
    context: ORPCContext,
    path: ['user'],
  })

  const procedureHooks = createGeneralHooks<
    typeof UserCreateInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'create'],
  })

  it('simple', () => {
    const result = hooks.useMutationState()
    expectTypeOf(result).toEqualTypeOf<
      MutationState<unknown, DefaultError, unknown>[]
    >()

    const result2 = procedureHooks.useMutationState()
    expectTypeOf(result2).toEqualTypeOf<
      MutationState<
        SchemaOutput<typeof UserSchema>,
        DefaultError,
        SchemaInput<typeof UserCreateInputSchema>
      >[]
    >()
  })

  it('with filters', () => {
    const result = procedureHooks.useMutationState({
      filters: {
        // @ts-expect-error input is now allowed on mutation
        input: {},
      },
    })
  })

  it('with select', () => {
    const r1 = hooks.useMutationState({
      select: (data) => {
        expectTypeOf(data).toEqualTypeOf<
          Mutation<unknown, DefaultError, unknown>
        >()
        return 1
      },
    })
    expectTypeOf(r1).toEqualTypeOf<number[]>()

    const r2 = procedureHooks.useMutationState({
      select: (data) => {
        expectTypeOf(data).toEqualTypeOf<
          Mutation<
            SchemaOutput<typeof UserSchema>,
            DefaultError,
            SchemaInput<typeof UserCreateInputSchema>
          >
        >()

        return '1'
      },
    })
    expectTypeOf(r2).toEqualTypeOf<string[]>()
  })
})
