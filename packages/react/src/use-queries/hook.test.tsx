import { renderHook, waitFor } from '@testing-library/react'
import { ORPCContext, orpcClient, wrapper } from '../../tests/orpc'
import { createUseQueriesBuilders } from './builders'
import { useQueriesFactory } from './hook'

describe('useQueriesFactory', () => {
  const useQueries = useQueriesFactory({
    context: ORPCContext,
  })

  it('simple', async () => {
    const queries = renderHook(
      () =>
        useQueries((o) => {
          expectTypeOf(o).toEqualTypeOf(
            createUseQueriesBuilders({ client: orpcClient }),
          )

          return [o.user.find({ id: '123' }), o.user.list({})]
        }),
      { wrapper: wrapper },
    )

    await waitFor(() =>
      expect(queries.result.current[0].data).toEqual({
        id: '123',
        name: 'name-123',
      }),
    )

    await waitFor(() =>
      expect(queries.result.current[1].data).toEqual({
        nextCursor: 2,
        users: [
          {
            id: 'id-0',
            name: 'number-0',
          },
          {
            id: 'id-1',
            name: 'number-1',
          },
        ],
      }),
    )
  })

  it('with combine', async () => {
    const data = renderHook(
      () =>
        useQueries(
          (o) => {
            expectTypeOf(o).toEqualTypeOf(
              createUseQueriesBuilders({ client: orpcClient }),
            )

            return [o.user.find({ id: '123' }), o.user.list({})]
          },
          ([findQuery, listQuery]) => {
            return [findQuery.data, listQuery.data] as const
          },
        ),
      { wrapper },
    )

    await waitFor(() =>
      expect(data.result.current[0]).toEqual({
        id: '123',
        name: 'name-123',
      }),
    )

    await waitFor(() =>
      expect(data.result.current[1]).toEqual({
        nextCursor: 2,
        users: [
          {
            id: 'id-0',
            name: 'number-0',
          },
          {
            id: 'id-1',
            name: 'number-1',
          },
        ],
      }),
    )
  })
})
