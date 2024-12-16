import type { InfiniteData } from '@tanstack/vue-query'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { orpc, queryClient } from './helpers'

beforeEach(() => {
  queryClient.clear()
})

describe('useQuery', () => {
  it('infer types correctly', async () => {
    const query = useQuery(orpc.user.find.queryOptions({
      input: { id: '123' },
      select(data) {
        expectTypeOf(data).toEqualTypeOf<{ id: string, name: string }>()

        return data
      },
    }), queryClient)

    expectTypeOf(query.data.value).toEqualTypeOf<{ id: string, name: string } | undefined>()
  })

  it('support ref', () => {
    useQuery(orpc.user.find.queryOptions({ input: { id: ref('123') } }))
    useQuery(orpc.user.find.queryOptions({ input: computed(() => ({ id: ref('123') })) }))
  })

  it('strict on input', () => {
    // @ts-expect-error options is required since input is required
    useQuery(orpc.user.find.queryOptions())
    // @ts-expect-error input is required
    useQuery(orpc.user.find.queryOptions({}))
    // @ts-expect-error input is invalid
    useQuery(orpc.user.find.queryOptions({ input: { id: 123 } }))
  })
})

describe('useInfiniteQuery', () => {
  it('infer types correctly', async () => {
    const query = useInfiniteQuery(orpc.user.list.infiniteOptions({
      input: {},
      getNextPageParam: lastPage => lastPage.nextCursor,
      select(data) {
        expectTypeOf(data).toMatchTypeOf<InfiniteData<{
          nextCursor: number
          users: {
            id: string
            name: string
          }[]
        }, number | undefined>>()

        return data
      },
    }), queryClient)

    expectTypeOf(query.data.value).toMatchTypeOf<InfiniteData<{
      nextCursor: number
      users: {
        id: string
        name: string
      }[]
    }, number | undefined> | undefined>()
  })

  it('cannot use on un cursor procedure', () => {
    // @ts-expect-error initialPageParam is required
    useInfiniteQuery(orpc.user.find.infiniteOptions({
      input: {} as any,
      getNextPageParam: {} as any,
    }))

    useInfiniteQuery(orpc.user.find.infiniteOptions({
      input: {} as any,
      getNextPageParam: {} as any,
      initialPageParam: {} as never, // required but must be never so cannot use this procedure
    }))
  })

  it('support ref', () => {
    useInfiniteQuery(orpc.user.list.infiniteOptions({
      input: { keyword: ref('keyword') },
      getNextPageParam: {} as any,
    }))

    useInfiniteQuery(orpc.user.list.infiniteOptions({
      input: computed(() => ({ keyword: ref('keyword') })),
      getNextPageParam: {} as any,
    }))
  })

  it('strict on input', () => {
    useInfiniteQuery(orpc.user.list.infiniteOptions({
      input: { keyword: 'keyword' },
      getNextPageParam: {} as any,
    }))

    // @ts-expect-error input is invalid
    useInfiniteQuery(orpc.user.list.infiniteOptions({
      // @ts-expect-error input is invalid
      input: { keyword: 1234 },
      getNextPageParam: {} as any,
    }))
  })
})

describe('useMutation', () => {
  it('infer types correctly', async () => {
    const query = useMutation(orpc.user.find.mutationOptions({
      onSuccess(data) {
        expectTypeOf(data).toEqualTypeOf<{ id: string, name: string }>()
      },
    }), queryClient)

    expectTypeOf(query.data.value).toEqualTypeOf<{ id: string, name: string } | undefined>()

    expectTypeOf(query.mutateAsync).toMatchTypeOf<(input: { id: string }) => Promise<{ id: string, name: string }>>()
  })
})
