import type { SchemaInput, SchemaOutput } from '@orpc/contract'
import type { InfiniteData, QueryState } from '@tanstack/react-query'
import type {
  UserFindInputSchema,
  UserListInputSchema,
  UserListOutputSchema,
  UserSchema,
} from '../tests/orpc'
import { createProcedureUtils } from './procedure-utils'

describe('fetchQuery', () => {
  const utils = createProcedureUtils<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({} as any)

  it('simple', async () => {
    expectTypeOf<Parameters<typeof utils.fetchQuery>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const data = await utils.fetchQuery({ id: '1' })

    expectTypeOf(data).toEqualTypeOf<SchemaOutput<typeof UserSchema>>()
  })

  it('with options', async () => {
    await utils.fetchQuery(
      { id: '1' },
      {
        initialData: { id: '1', name: 'name-1' },
      },
    )

    await utils.fetchQuery(
      { id: '1' },
      {
        // @ts-expect-error invalid initialData
        initialData: { id: '1' },
      },
    )
  })
})

describe('fetchInfiniteQuery', () => {
  const utils = createProcedureUtils<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({} as any)

  it('simple', async () => {
    expectTypeOf<
      Parameters<typeof utils.fetchInfiniteQuery>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const data = await utils.fetchInfiniteQuery({}, {})

    expectTypeOf(data).toEqualTypeOf<
      InfiniteData<
        SchemaOutput<typeof UserListOutputSchema>,
        number | undefined
      >
    >()
  })

  it('with options', async () => {
    await utils.fetchInfiniteQuery(
      { keyword: '1' },
      {
        initialPageParam: 4,
        pages: 5,
        getNextPageParam(lastPage) {
          expectTypeOf(lastPage).toEqualTypeOf<
            SchemaOutput<typeof UserListOutputSchema>
          >()

          return lastPage.nextCursor
        },
      },
    )

    await utils.fetchInfiniteQuery(
      { keyword: '1' },
      // @ts-expect-error missing getNextPageParam when pages is set
      {
        pages: 4,
      },
    )

    await utils.fetchInfiniteQuery(
      {},
      {
        initialData: { pageParams: [], pages: [] },
      },
    )

    await utils.fetchInfiniteQuery(
      {},
      {
        // @ts-expect-error invalid initialData
        initialData: { pageParams: [] },
      },
    )
  })
})

describe('prefetchQuery', () => {
  const utils = createProcedureUtils<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({} as any)

  it('simple', async () => {
    expectTypeOf<Parameters<typeof utils.prefetchQuery>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const result = utils.prefetchQuery({ id: '1' })

    expectTypeOf(result).toEqualTypeOf<Promise<void>>()
  })

  it('with options', async () => {
    await utils.prefetchQuery(
      { id: '1' },
      {
        initialData: { id: '1', name: 'name-1' },
      },
    )

    await utils.prefetchQuery(
      { id: '1' },
      {
        // @ts-expect-error invalid initialData
        initialData: { id: '1' },
      },
    )
  })
})

describe('prefetchInfiniteQuery', () => {
  const utils = createProcedureUtils<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<
      Parameters<typeof utils.prefetchInfiniteQuery>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const result = utils.prefetchInfiniteQuery({}, {})

    expectTypeOf(result).toEqualTypeOf<Promise<void>>()
  })

  it('with options', async () => {
    await utils.prefetchInfiniteQuery(
      { keyword: '1' },
      {
        initialPageParam: 4,
        pages: 5,
        getNextPageParam(lastPage) {
          expectTypeOf(lastPage).toEqualTypeOf<
            SchemaOutput<typeof UserListOutputSchema>
          >()

          return lastPage.nextCursor
        },
      },
    )

    await utils.prefetchInfiniteQuery(
      { keyword: '1' },
      // @ts-expect-error missing getNextPageParam when pages is set
      {
        pages: 4,
      },
    )

    await utils.prefetchInfiniteQuery(
      {},
      {
        initialData: { pageParams: [], pages: [] },
      },
    )

    await utils.prefetchInfiniteQuery(
      {},
      {
        // @ts-expect-error invalid initialData
        initialData: { pageParams: [] },
      },
    )
  })
})

describe('getQueryData', () => {
  const utils = createProcedureUtils<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<Parameters<typeof utils.getQueryData>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const data = utils.getQueryData({ id: '1' })

    expectTypeOf(data).toEqualTypeOf<
      SchemaOutput<typeof UserSchema> | undefined
    >()
  })
})

describe('getInfiniteQueryData', () => {
  const utils = createProcedureUtils<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<
      Parameters<typeof utils.getInfiniteQueryData>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const data = utils.getInfiniteQueryData({})

    expectTypeOf(data).toEqualTypeOf<
      | undefined
      | InfiniteData<
          SchemaOutput<typeof UserListOutputSchema>,
          number | undefined
        >
    >()
  })
})

describe('ensureQueryData', () => {
  const utils = createProcedureUtils<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({} as any)

  it('simple', async () => {
    expectTypeOf<Parameters<typeof utils.ensureQueryData>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const data = await utils.ensureQueryData({ id: '1' })

    expectTypeOf(data).toEqualTypeOf<SchemaOutput<typeof UserSchema>>()
  })

  it('with options', async () => {
    await utils.ensureQueryData(
      { id: '1' },
      {
        initialData: { id: '1', name: 'name-1' },
      },
    )

    await utils.ensureQueryData(
      { id: '1' },
      {
        // @ts-expect-error invalid initialData
        initialData: { id: '1' },
      },
    )
  })
})

describe('ensureInfiniteQuery', () => {
  const utils = createProcedureUtils<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({} as any)

  it('simple', async () => {
    expectTypeOf<
      Parameters<typeof utils.ensureInfiniteQueryData>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const data = await utils.ensureInfiniteQueryData({}, {})

    expectTypeOf(data).toEqualTypeOf<
      InfiniteData<
        SchemaOutput<typeof UserListOutputSchema>,
        number | undefined
      >
    >()
  })

  it('with options', async () => {
    await utils.ensureInfiniteQueryData(
      { keyword: '1' },
      {
        initialPageParam: 4,
        pages: 5,
        getNextPageParam(lastPage) {
          expectTypeOf(lastPage).toEqualTypeOf<
            SchemaOutput<typeof UserListOutputSchema>
          >()

          return lastPage.nextCursor
        },
      },
    )

    await utils.ensureInfiniteQueryData(
      { keyword: '1' },
      // @ts-expect-error missing getNextPageParam when pages is set
      {
        pages: 4,
      },
    )

    await utils.ensureInfiniteQueryData(
      {},
      {
        initialData: { pageParams: [], pages: [] },
      },
    )

    await utils.ensureInfiniteQueryData(
      {},
      {
        // @ts-expect-error invalid initialData
        initialData: { pageParams: [] },
      },
    )
  })
})

describe('getQueryState', () => {
  const utils = createProcedureUtils<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<Parameters<typeof utils.getQueryState>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const data = utils.getQueryState({ id: '1' })

    expectTypeOf(data).toEqualTypeOf<
      undefined | QueryState<SchemaOutput<typeof UserSchema>, unknown>
    >()
  })
})

describe('getInfiniteQueryState', () => {
  const utils = createProcedureUtils<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<
      Parameters<typeof utils.getInfiniteQueryState>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const data = utils.getInfiniteQueryState({})

    expectTypeOf(data).toEqualTypeOf<
      | undefined
      | QueryState<
          InfiniteData<
            SchemaOutput<typeof UserListOutputSchema>,
            number | undefined
          >,
          unknown
        >
    >()
  })
})

describe('setQueryData', () => {
  const utils = createProcedureUtils<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<Parameters<typeof utils.setQueryData>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const data = utils.setQueryData({ id: '1' }, (data) => {
      expectTypeOf(data).toEqualTypeOf<
        SchemaOutput<typeof UserSchema> | undefined
      >()

      return {
        id: '1',
        name: 'name-1',
      }
    })

    expectTypeOf(data).toEqualTypeOf<
      SchemaOutput<typeof UserSchema> | undefined
    >()
  })

  it('with options', () => {
    utils.setQueryData(
      { id: '1' },
      { id: '1', name: '5' },
      {
        updatedAt: 1233,
      },
    )
  })
})

describe('setInfiniteQueryData', () => {
  const utils = createProcedureUtils<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({} as any)

  it('simple', () => {
    expectTypeOf<
      Parameters<typeof utils.setInfiniteQueryData>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const data = utils.setInfiniteQueryData({}, (data) => {
      expectTypeOf(data).toEqualTypeOf<
        | undefined
        | InfiniteData<
            SchemaOutput<typeof UserListOutputSchema>,
            number | undefined
          >
      >()

      return {
        pageParams: [],
        pages: [],
      }
    })

    expectTypeOf(data).toEqualTypeOf<
      | undefined
      | InfiniteData<
          SchemaOutput<typeof UserListOutputSchema>,
          number | undefined
        >
    >()
  })

  it('with options', () => {
    utils.setInfiniteQueryData(
      { keyword: '1' },
      { pages: [], pageParams: [] },
      {
        updatedAt: 1244,
      },
    )
  })
})
