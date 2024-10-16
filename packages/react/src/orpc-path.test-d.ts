import { orpc } from '../tests/orpc'
import { getORPCPath } from './orpc-path'

it('required valid orpc', () => {
  getORPCPath(orpc.ping)
  getORPCPath(orpc.user.find)

  // @ts-expect-error invalid orpc
  getORPCPath({})

  // @ts-expect-error cannot use in root
  getORPCPath(orpc)
})
