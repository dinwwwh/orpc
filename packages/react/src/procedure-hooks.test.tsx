import type { SchemaOutput } from '@orpc/contract'
import { renderHook, waitFor } from '@testing-library/react'
import {
  ORPCContext,
  type UserFindInputSchema,
  type UserListInputSchema,
  type UserListOutputSchema,
  type UserSchema,
  wrapper,
} from '../tests/orpc'
import { createProcedureHooks } from './procedure-hooks'

describe('useQuery', () => {
  const hooks = createProcedureHooks<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'find'],
  })

  it('on success', async () => {
    const { result } = renderHook(() => hooks.useQuery({ id: '1' }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(result.current.data).toEqual({
      id: '1',
      name: 'name-1',
    })
  })

  it('on error', async () => {
    // @ts-expect-error invalid input
    const { result } = renderHook(() => hooks.useQuery({ id: 1234 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.status).toBe('error'))

    expect((result.current.error as any).message).toEqual(
      'Validation input failed',
    )
  })
})

describe('useInfiniteQuery', () => {
  const hooks = createProcedureHooks<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({
    context: ORPCContext,
    path: ['user', 'list'],
  })

  it('on success', async () => {
    const { result } = renderHook(
      () =>
        hooks.useInfiniteQuery(
          { keyword: '1' },
          {
            getNextPageParam(lastPage) {
              return lastPage.nextCursor
            },
          },
        ),
      {
        wrapper,
      },
    )

    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(result.current.data).toMatchObject({
      pages: [
        {
          nextCursor: 2,
          users: [{ name: 'number-0' }, { name: 'number-1' }],
        },
      ],
      pageParams: [undefined],
    })

    result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.pages.length).toBe(2))

    expect(result.current.data).toMatchObject({
      pages: [
        {
          nextCursor: 2,
          users: [{ name: 'number-0' }, { name: 'number-1' }],
        },
        {
          nextCursor: 4,
          users: [{ name: 'number-2' }, { name: 'number-3' }],
        },
      ],
      pageParams: [undefined, 2],
    })
  })

  it('on error', async () => {
    const { result } = renderHook(
      () =>
        hooks.useInfiniteQuery(
          // @ts-expect-error invalid input
          { keyword: 1244 },
          {
            getNextPageParam(lastPage) {
              return lastPage.nextCursor
            },
          },
        ),
      {
        wrapper,
      },
    )

    await waitFor(() => expect(result.current.status).toBe('error'))

    expect((result.current.error as any).message).toEqual(
      'Validation input failed',
    )
  })
})
