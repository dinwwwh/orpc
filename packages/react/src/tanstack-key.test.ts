import { orpc } from '../tests/orpc'
import {
  getMutationKey,
  getMutationKeyFromPath,
  getQueryKey,
  getQueryKeyFromPath,
} from './tanstack-key'

describe('query', () => {
  it('from path', () => {
    expect(getQueryKeyFromPath(['user', 'find'])).toEqual([
      ['user', 'find'],
      {},
    ])

    expect(
      getQueryKeyFromPath(['user', 'find'], {
        input: { id: '1' },
      }),
    ).toEqual([['user', 'find'], { input: { id: '1' } }])

    expect(
      getQueryKeyFromPath(['user', 'find'], {
        input: { id: '1' },
        type: 'query',
      }),
    ).toEqual([['user', 'find'], { input: { id: '1' }, type: 'query' }])

    expect(
      getQueryKeyFromPath(['user', 'find'], {
        type: 'infinite',
      }),
    ).toEqual([['user', 'find'], { type: 'infinite' }])
  })

  it('from orpc', () => {
    expect(getQueryKey(orpc.ping)).toEqual([['ping'], {}])

    expect(getQueryKey(orpc.user.find)).toEqual([['user', 'find'], {}])

    expect(getQueryKey(orpc.user.find, { input: { id: '1' } })).toEqual([
      ['user', 'find'],
      { input: { id: '1' } },
    ])

    expect(
      getQueryKey(orpc.user.find, { input: { id: '1' }, type: 'infinite' }),
    ).toEqual([['user', 'find'], { input: { id: '1' }, type: 'infinite' }])
  })
})

describe('mutation', () => {
  it('from path', () => {
    expect(getMutationKeyFromPath(['user', 'create'])).toEqual([
      ['user', 'create'],
    ])
  })

  it('from orpc', () => {
    expect(getMutationKey(orpc.user.create)).toEqual([['user', 'create']])
  })
})
