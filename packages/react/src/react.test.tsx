import { renderHook, waitFor } from '@testing-library/react'
import { orpc, orpcClient, queryClient, wrapper } from '../tests/orpc'

beforeEach(() => {
  queryClient.clear()
})

it('useUtils', async () => {
  const { result } = renderHook(() => orpc.useUtils(), { wrapper: wrapper })

  const promise = result.current.user.find.ensureQueryData({ id: '1' })
  expect(result.current.user.isFetching()).toBe(1)
  const data = await promise
  expect(result.current.user.isFetching()).toBe(0)

  let old: any
  result.current.user.setQueriesData({}, (old_: any) => {
    old = old_
  })

  expect(data).toEqual({
    id: '1',
    name: 'name-1',
  })
  expect(old).toEqual(data)
})

it('useContext', async () => {
  const { result } = renderHook(() => orpc.useContext(), { wrapper: wrapper })

  expect(result.current.client).toBe(orpcClient)
  expect(result.current.queryClient).toBe(queryClient)

  expect(() => renderHook(() => orpc.useContext())).throws(
    'useORPCContext must be used within a <ORPCContext.Provider>, please see the docs',
  )
})

it('useQueries', { todo: true }, async () => {})

it('hooks', async () => {
  const isFetching = renderHook(() => orpc.user.useIsFetching(), {
    wrapper: wrapper,
  })
  const isMutating = renderHook(() => orpc.user.useIsMutating(), {
    wrapper: wrapper,
  })

  expect(isFetching.result.current).toBe(0)
  expect(isMutating.result.current).toBe(0)

  const query = renderHook(() => orpc.user.find.useQuery({ id: '1' }), {
    wrapper: wrapper,
  })
  const mutation = renderHook(() => orpc.user.create.useMutation(), {
    wrapper: wrapper,
  })

  await waitFor(() => expect(query.result.current.status).toEqual('pending'))

  expect(isFetching.result.current).toBe(1)
  expect(isMutating.result.current).toBe(0)

  await waitFor(() =>
    expect(query.result.current.data).toEqual({
      id: '1',
      name: 'name-1',
    }),
  )

  expect(isFetching.result.current).toBe(0)
  expect(isMutating.result.current).toBe(0)

  mutation.result.current.mutate({ name: 'name-2' })

  await waitFor(() => expect(mutation.result.current.status).toEqual('pending'))

  expect(isFetching.result.current).toBe(0)
  expect(isMutating.result.current).toBe(1)

  await waitFor(() => expect(mutation.result.current.status).toEqual('success'))

  expect(isFetching.result.current).toBe(0)
  expect(isMutating.result.current).toBe(0)

  expect(mutation.result.current.data).toEqual({
    id: expect.any(String),
    name: 'name-2',
  })
})
