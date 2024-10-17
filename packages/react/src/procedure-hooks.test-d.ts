import type { SchemaInput, SchemaOutput } from '@orpc/contract'
import type { DefaultError, InfiniteData } from '@tanstack/react-query'
import {} from '@testing-library/react'
import {
  ORPCContext,
  type UserCreateInputSchema,
  type UserFindInputSchema,
  type UserListInputSchema,
  type UserListOutputSchema,
  type UserSchema,
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

  it('simple', () => {
    expectTypeOf<Parameters<typeof hooks.useQuery>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const query = hooks.useQuery({ id: '1' })

    expectTypeOf(query.data).toEqualTypeOf<
      SchemaOutput<typeof UserSchema> | undefined
    >()
  })

  it('with select', async () => {
    const query = hooks.useQuery(
      { id: '1' },
      {
        select(data) {
          expectTypeOf(data).toEqualTypeOf<SchemaOutput<typeof UserSchema>>()

          return {
            select: data,
          }
        },
      },
    )

    expectTypeOf(query.data).toEqualTypeOf<
      { select: SchemaOutput<typeof UserSchema> } | undefined
    >()
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

  it('simple', () => {
    expectTypeOf<Parameters<typeof hooks.useInfiniteQuery>[0]>().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const query = hooks.useInfiniteQuery(
      { keyword: '1' },
      {
        getNextPageParam(lastPage) {
          return lastPage.nextCursor
        },
      },
    )

    expectTypeOf(query.data).toEqualTypeOf<
      | undefined
      | InfiniteData<
          SchemaOutput<typeof UserListOutputSchema>,
          number | undefined
        >
    >()
  })

  it('with select', () => {
    const query = hooks.useInfiniteQuery(
      {},
      {
        initialPageParam: 12344,
        getNextPageParam(lastPage) {
          return lastPage.nextCursor
        },
        select(data) {
          expectTypeOf(data).toEqualTypeOf<
            InfiniteData<
              SchemaOutput<typeof UserListOutputSchema>,
              number | undefined
            >
          >()

          return {
            select: data,
          }
        },
      },
    )

    expectTypeOf(query.data).toEqualTypeOf<
      | undefined
      | {
          select: InfiniteData<
            SchemaOutput<typeof UserListOutputSchema>,
            number | undefined
          >
        }
    >()
  })
})

describe('useSuspenseQuery', () => {
  const hooks = createProcedureHooks<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'find'],
  })

  it('simple', () => {
    expectTypeOf<Parameters<typeof hooks.useSuspenseQuery>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const query = hooks.useSuspenseQuery({ id: '1' })

    expectTypeOf(query.data).toEqualTypeOf<SchemaOutput<typeof UserSchema>>()
  })

  it('with select', async () => {
    const query = hooks.useSuspenseQuery(
      { id: '1' },
      {
        select(data) {
          expectTypeOf(data).toEqualTypeOf<SchemaOutput<typeof UserSchema>>()

          return {
            select: data,
          }
        },
      },
    )

    expectTypeOf(query.data).toEqualTypeOf<{
      select: SchemaOutput<typeof UserSchema>
    }>()
  })
})

describe('useSuspenseInfiniteQuery', () => {
  const hooks = createProcedureHooks<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({
    context: ORPCContext,
    path: ['user', 'list'],
  })

  it('simple', () => {
    expectTypeOf<
      Parameters<typeof hooks.useSuspenseInfiniteQuery>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    const query = hooks.useSuspenseInfiniteQuery(
      { keyword: '1' },
      {
        getNextPageParam(lastPage) {
          return lastPage.nextCursor
        },
      },
    )

    expectTypeOf(query.data).toEqualTypeOf<
      InfiniteData<
        SchemaOutput<typeof UserListOutputSchema>,
        number | undefined
      >
    >()
  })

  it('with select', () => {
    const query = hooks.useSuspenseInfiniteQuery(
      {},
      {
        initialPageParam: 12344,
        getNextPageParam(lastPage) {
          return lastPage.nextCursor
        },
        select(data) {
          expectTypeOf(data).toEqualTypeOf<
            InfiniteData<
              SchemaOutput<typeof UserListOutputSchema>,
              number | undefined
            >
          >()

          return {
            select: data,
          }
        },
      },
    )

    expectTypeOf(query.data).toEqualTypeOf<{
      select: InfiniteData<
        SchemaOutput<typeof UserListOutputSchema>,
        number | undefined
      >
    }>()
  })
})

describe('usePrefetchQuery', () => {
  const hooks = createProcedureHooks<
    typeof UserFindInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'find'],
  })

  it('simple', () => {
    expectTypeOf<Parameters<typeof hooks.usePrefetchQuery>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserFindInputSchema>
    >()

    const query = hooks.usePrefetchQuery({ id: '1' })

    expectTypeOf(query).toEqualTypeOf<void>()
  })
})

describe('usePrefetchInfiniteQuery', () => {
  const hooks = createProcedureHooks<
    typeof UserListInputSchema,
    typeof UserListOutputSchema,
    SchemaOutput<typeof UserListOutputSchema>
  >({
    context: ORPCContext,
    path: ['user', 'list'],
  })

  it('simple', () => {
    expectTypeOf<
      Parameters<typeof hooks.usePrefetchInfiniteQuery>[0]
    >().toMatchTypeOf<{
      keyword?: string
      cursor?: never /** prevent user to set cursor */
    }>()

    hooks.usePrefetchInfiniteQuery({ keyword: '1' }, {})

    hooks.usePrefetchInfiniteQuery(
      { keyword: '1' },
      // @ts-expect-error required getNextPageParam when pages is set
      {
        initialPageParam: 12344,
        pages: 3,
      },
    )

    const query = hooks.usePrefetchInfiniteQuery(
      { keyword: '1' },
      {
        initialPageParam: 12344,
        pages: 3,
        getNextPageParam(lastPage) {
          return lastPage.nextCursor
        },
      },
    )

    expectTypeOf(query).toEqualTypeOf<void>()
  })
})

describe('useMutation', () => {
  const hooks = createProcedureHooks<
    typeof UserCreateInputSchema,
    typeof UserSchema,
    SchemaOutput<typeof UserSchema>
  >({
    context: ORPCContext,
    path: ['user', 'create'],
  })

  it('simple', () => {
    const mutation = hooks.useMutation()

    expectTypeOf<Parameters<typeof mutation.mutate>[0]>().toEqualTypeOf<
      SchemaInput<typeof UserCreateInputSchema>
    >()

    expectTypeOf(mutation.data).toEqualTypeOf<
      SchemaOutput<typeof UserSchema> | undefined
    >()
  })

  it('with options', () => {
    hooks.useMutation({
      onSuccess(data) {
        expectTypeOf(data).toEqualTypeOf<SchemaOutput<typeof UserSchema>>()
      },
      onError(error) {
        expectTypeOf(error).toEqualTypeOf<DefaultError>()
      },
    })
  })
})
