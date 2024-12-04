import { oc } from '@orpc/contract'
import { z } from 'zod'
import { os, toContractRouter } from '.'

it('toContractRouter', () => {
  const p1 = oc.input(z.string()).output(z.string())
  const p2 = oc.output(z.string())
  const p3 = oc.route({ method: 'GET', path: '/test' })

  const contract = oc.router({
    p1,

    nested: oc.router({
      p2,
    }),

    nested2: {
      p3,
    },
  })

  const osw = os.contract(contract)

  const router = osw.router({
    p1: osw.p1.func(() => {
      return 'unnoq'
    }),

    nested: osw.nested.router({
      p2: osw.nested.p2.func(() => {
        return 'unnoq'
      }),
    }),

    nested2: {
      p3: osw.nested2.p3.func(() => {
        return 'unnoq'
      }),
    },
  })

  expect(toContractRouter(router)).toEqual(contract)
  expect(toContractRouter(contract)).toEqual(contract)
})
