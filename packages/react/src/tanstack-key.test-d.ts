import { orpc } from '../tests/orpc'
import { getMutationKey, getQueryKey } from './tanstack-key'

describe('query', () => {
  it('required valid orpc', () => {
    getQueryKey(orpc.ping)
    getQueryKey(orpc.user.find)

    // @ts-expect-error invalid orpc
    getQueryKey({})

    // @ts-expect-error cannot use in root
    getQueryKey(orpc)
  })

  it('infer input', () => {
    getQueryKey(orpc.user.find, { input: { id: '1' } })

    // @ts-expect-error invalid input
    getQueryKey(orpc.user.find, { input: { id: 1234 } })
  })
})

describe('mutation', () => {
  it('required valid orpc', () => {
    getMutationKey(orpc.ping)
    getMutationKey(orpc.user.find)

    // @ts-expect-error invalid orpc
    getMutationKey({})

    // @ts-expect-error cannot use in root
    getMutationKey(orpc)
  })
})
