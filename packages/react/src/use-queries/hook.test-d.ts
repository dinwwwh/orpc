import type { SchemaOutput } from '@orpc/contract'
import {
  ORPCContext,
  type UserListOutputSchema,
  type UserSchema,
  orpcClient,
} from '../../tests/orpc'
import { createUseQueriesBuilders } from './builders'
import { useQueriesFactory } from './hook'

describe('useQueriesFactory', () => {
  const useQueries = useQueriesFactory({
    context: ORPCContext,
  })

  it('simple', () => {
    const [findQuery, listQuery] = useQueries((o) => {
      expectTypeOf(o).toEqualTypeOf(
        createUseQueriesBuilders({ client: orpcClient }),
      )

      return [o.user.find({ id: '123' }), o.user.list({})]
    })

    expectTypeOf(findQuery.data).toEqualTypeOf<
      SchemaOutput<typeof UserSchema> | undefined
    >()

    expectTypeOf(listQuery.data).toEqualTypeOf<
      SchemaOutput<typeof UserListOutputSchema> | undefined
    >()
  })

  it('with combine', () => {
    const [findData, listData] = useQueries(
      (o) => {
        expectTypeOf(o).toEqualTypeOf(
          createUseQueriesBuilders({ client: orpcClient }),
        )

        return [o.user.find({ id: '123' }), o.user.list({})]
      },
      ([findQuery, listQuery]) => {
        expectTypeOf(findQuery.data).toEqualTypeOf<
          SchemaOutput<typeof UserSchema> | undefined
        >()

        expectTypeOf(listQuery.data).toEqualTypeOf<
          SchemaOutput<typeof UserListOutputSchema> | undefined
        >()

        return [findQuery.data, listQuery.data] as const
      },
    )

    expectTypeOf(findData).toEqualTypeOf<
      SchemaOutput<typeof UserSchema> | undefined
    >()

    expectTypeOf(listData).toEqualTypeOf<
      SchemaOutput<typeof UserListOutputSchema> | undefined
    >()
  })
})
