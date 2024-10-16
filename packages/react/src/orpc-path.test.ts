import { orpc } from '../tests/orpc'
import { getORPCPath } from './orpc-path'

it('can get path', () => {
  expect(getORPCPath(orpc.ping)).toEqual(['ping'])
  expect(getORPCPath(orpc.user.find)).toEqual(['user', 'find'])
})

it('throw on invalid orpc', () => {
  // @ts-expect-error invalid orpc
  expect(() => getORPCPath({})).toThrow()
})
