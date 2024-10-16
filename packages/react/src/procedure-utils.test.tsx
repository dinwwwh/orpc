import { orpcClient, queryClient } from '../tests/orpc'
import { createProcedureUtils } from './procedure-utils'

beforeEach(() => {
  queryClient.clear()
})

describe('fetchQuery', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.find,
    path: ['user', 'find'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const data = await utils.fetchQuery({ id: '123455' })

    expect(data.id).toEqual('123455')

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [
          ['user', 'find'],
          { input: { id: '123455' }, type: 'query' },
        ],
      })[0]?.[1],
    ).toBe(data)
  })

  it('on error', () => {
    // @ts-expect-error invalid input
    expect(utils.fetchQuery({ id: 12233 })).rejects.toThrowError(
      'Validation input failed',
    )
  })
})

describe('fetchInfiniteQuery', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.list,
    path: ['user', 'list'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const data = await utils.fetchInfiniteQuery({}, {})

    expect(data).toMatchObject({
      pageParams: [undefined],
      pages: [
        {
          nextCursor: 2,
          users: [{ name: 'number-0' }, { name: 'number-1' }],
        },
      ],
    })

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [['user', 'list'], { input: {}, type: 'infinite' }],
      })[0]?.[1],
    ).toBe(data)
  })

  it('on error', () => {
    expect(
      // @ts-expect-error invalid input
      utils.fetchInfiniteQuery({ keyword: 1222 }, {}),
    ).rejects.toThrowError('Validation input failed')
  })
})

describe('prefetchQuery', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.find,
    path: ['user', 'find'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const result = await utils.prefetchQuery({ id: '123455' })
    expect(result).toEqual(undefined)

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [
          ['user', 'find'],
          { input: { id: '123455' }, type: 'query' },
        ],
      })[0]?.[1],
    ).toEqual({
      id: '123455',
      name: 'name-123455',
    })
  })

  it('on error', () => {
    expect(
      // @ts-expect-error invalid input
      utils.prefetchQuery({ id: 1244 }),
    ).resolves.toEqual(undefined)
  })
})

describe('prefetchInfiniteQuery', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.list,
    path: ['user', 'list'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const result = await utils.prefetchInfiniteQuery({}, {})
    expect(result).toEqual(undefined)

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [['user', 'list'], { input: {}, type: 'infinite' }],
      })[0]?.[1],
    ).toMatchObject({
      pageParams: [undefined],
      pages: [
        {
          nextCursor: 2,
          users: [{ name: 'number-0' }, { name: 'number-1' }],
        },
      ],
    })
  })

  it('on error', () => {
    expect(
      // @ts-expect-error invalid input
      utils.prefetchInfiniteQuery({ keyword: 1222 }, {}),
    ).resolves.toEqual(undefined)
  })
})

describe('ensureQueryData', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.find,
    path: ['user', 'find'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const data = await utils.ensureQueryData({ id: '123455' })

    expect(data.id).toEqual('123455')

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [
          ['user', 'find'],
          { input: { id: '123455' }, type: 'query' },
        ],
      })[0]?.[1],
    ).toBe(data)
  })

  it('on error', () => {
    // @ts-expect-error invalid input
    expect(utils.ensureQueryData({ id: 12233 })).rejects.toThrowError(
      'Validation input failed',
    )
  })
})

describe('ensureInfiniteQuery', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.list,
    path: ['user', 'list'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const data = await utils.ensureInfiniteQueryData({}, {})

    expect(data).toMatchObject({
      pageParams: [undefined],
      pages: [
        {
          nextCursor: 2,
          users: [{ name: 'number-0' }, { name: 'number-1' }],
        },
      ],
    })

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [['user', 'list'], { input: {}, type: 'infinite' }],
      })[0]?.[1],
    ).toBe(data)
  })

  it('on error', () => {
    expect(
      // @ts-expect-error invalid input
      utils.ensureInfiniteQueryData({ keyword: 1222 }, {}),
    ).rejects.toThrowError('Validation input failed')
  })
})

describe('getQueryData', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.find,
    path: ['user', 'find'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    expect(utils.getQueryData({ id: '123455' })).toEqual(undefined)
    const data = await utils.ensureQueryData({ id: '123455' })
    expect(utils.getQueryData({ id: '123455' })).toBe(data)
  })
})

describe('getInfiniteQueryData', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.list,
    path: ['user', 'list'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    expect(utils.getInfiniteQueryData({})).toEqual(undefined)
    const data = await utils.ensureInfiniteQueryData({}, {})
    expect(utils.getInfiniteQueryData({})).toBe(data)
  })
})

describe('getQueryState', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.find,
    path: ['user', 'find'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    expect(utils.getQueryState({ id: '123455' })).toEqual(undefined)
    const data = await utils.ensureQueryData({ id: '123455' })
    expect(utils.getQueryState({ id: '123455' })).toMatchObject({
      status: 'success',
      data,
    })
  })
})

describe('getInfiniteQueryState', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.list,
    path: ['user', 'list'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    expect(utils.getInfiniteQueryState({})).toEqual(undefined)
    const data = await utils.ensureInfiniteQueryData({}, {})
    expect(utils.getInfiniteQueryState({})).toMatchObject({
      status: 'success',
      data,
    })
  })
})

describe('setQueryData', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.find,
    path: ['user', 'find'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const original = await utils.ensureQueryData({ id: '1222' })

    const user = {
      id: '1222',
      name: 'name-1222-fake-fake',
    }

    utils.setQueryData({ id: user.id }, (data) => {
      expect(data).toBe(original)

      return user
    })

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [['user', 'find'], { input: { id: user.id }, type: 'query' }],
      })[0]?.[1],
    ).toEqual(user)
  })
})

describe('getInfiniteQueryData', () => {
  const utils = createProcedureUtils({
    client: orpcClient.user.list,
    path: ['user', 'list'],
    queryClient: queryClient,
  })

  it('on success', async () => {
    const original = await utils.ensureInfiniteQueryData({}, {})

    const data = {
      pages: [],
      pageParams: [],
    }

    utils.setInfiniteQueryData({}, (ori) => {
      expect(ori).toBe(original)

      return data
    })

    expect(
      queryClient.getQueriesData({
        exact: true,
        queryKey: [['user', 'list'], { input: {}, type: 'infinite' }],
      })[0]?.[1],
    ).toEqual(data)
  })
})
