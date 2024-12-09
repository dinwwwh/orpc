import type { InfiniteData } from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createProcedureUtils } from './utils-procedure'

describe('queryOptions', () => {
  const client = vi.fn((input: number | undefined) => Promise.resolve(input?.toString()))
  const utils = createProcedureUtils('__ORPC__', client)

  const client2 = vi.fn((input: number) => Promise.resolve(input.toString()))
  const utils2 = createProcedureUtils('__ORPC__', client2)

  it('infer correct input type', () => {
    utils.queryOptions({ input: 1 })
    utils.queryOptions({ input: undefined })

    // @ts-expect-error invalid input
    utils.queryOptions({ input: '1' })
  })

  it('can be called without argument', () => {
    utils.queryOptions()
    // @ts-expect-error invalid is required
    utils2.queryOptions()
  })

  it('infer correct output type', () => {
    const query = useQuery(utils2.queryOptions({ input: 1 }))

    if (query.status === 'success') {
      expectTypeOf(query.data).toEqualTypeOf<string>()
    }
  })

  it('work with select options', () => {
    const query = useQuery(utils2.queryOptions({
      input: 1,
      select(data) {
        expectTypeOf(data).toEqualTypeOf<string>()

        return 'new' as const
      },
    }))

    if (query.status === 'success') {
      expectTypeOf(query.data).toEqualTypeOf<'new'>()
    }
  })
})

describe('infiniteOptions', () => {
  const getNextPageParam = vi.fn()

  it('cannot use on procedure without input object-able', () => {
    const utils = createProcedureUtils('__ORPC__', {} as (input: number) => Promise<string>)

    // @ts-expect-error missing initialPageParam
    utils.infiniteOptions({
      input: 123,
      getNextPageParam,
    })

    utils.infiniteOptions({
      input: 123,
      getNextPageParam,
      // @ts-expect-error initialPageParam must be never
      initialPageParam: 123,
    })

    utils.infiniteOptions({
      input: 123,
      getNextPageParam,
      initialPageParam: 123 as never,
    })
  })

  it('infer correct input type', () => {
    const utils = createProcedureUtils('__ORPC__', {} as (input: { limit?: number, cursor: number }) => Promise<string>)

    utils.infiniteOptions({
      input: {
        limit: 1,
      },
      getNextPageParam,
      initialPageParam: 1,
    })
    utils.infiniteOptions({
      input: {
        limit: undefined,
      },
      getNextPageParam,
      initialPageParam: 1,

    })

    utils.infiniteOptions({
      input: {
        // @ts-expect-error invalid input
        limit: 'string',
        // cursor will be ignored
        cursor: {},
      },
      getNextPageParam,
      initialPageParam: 1,
    })
  })

  it('infer correct initialPageParam type', () => {
    const utils = createProcedureUtils('__ORPC__', {} as (input: { limit?: number, cursor: number }) => Promise<string>)

    utils.infiniteOptions({
      input: {},
      getNextPageParam,
      initialPageParam: 1,
    })

    utils.infiniteOptions({
      input: {},
      getNextPageParam,
      // @ts-expect-error initialPageParam must be number
      initialPageParam: '234',
    })

    // @ts-expect-error initialPageParam is required
    utils.infiniteOptions({
      input: {},
      getNextPageParam,
    })
  })

  it('initialPageParam can be optional', () => {
    const utils = createProcedureUtils('__ORPC__', {} as (input: { limit?: number, cursor?: number }) => Promise<string>)

    utils.infiniteOptions({
      input: {},
      getNextPageParam,
    })
  })

  it('infer correct output type', () => {
    const utils = createProcedureUtils('__ORPC__', {} as (input: { limit?: number, cursor: number }) => Promise<string>)
    const query = useInfiniteQuery(utils.infiniteOptions({
      input: {
        limit: 1,
      },
      getNextPageParam,
      initialPageParam: 1,
    }))

    if (query.status === 'success') {
      expectTypeOf(query.data).toEqualTypeOf<InfiniteData<string, number>>()
    }
  })

  it('work with select options', () => {
    const utils = createProcedureUtils('__ORPC__', {} as (input: { limit?: number, cursor: number }) => Promise<string>)
    const query = useInfiniteQuery(utils.infiniteOptions({
      input: {
        limit: 1,
      },
      getNextPageParam,
      initialPageParam: 1,
      select(data) {
        expectTypeOf(data).toEqualTypeOf<InfiniteData<string, number>>()

        return 'new' as const
      },
    }))

    if (query.status === 'success') {
      expectTypeOf(query.data).toEqualTypeOf<'new'>()
    }
  })
})