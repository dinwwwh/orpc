import type { InferRouterInputs, InferRouterOutputs, RouterWithContract } from '.'
import { oc } from '@orpc/contract'
import { z } from 'zod'
import { os } from '.'

const ping = os
  .input(z.object({ ping: z.string().transform(() => 1) }))
  .output(z.object({ pong: z.number().transform(() => '1') }))
  .func(() => ({ pong: 1 }))

const lazyRouter = os.lazy(() => Promise.resolve({
  default: {
    ping,
    lazyPing: os.lazy(() => Promise.resolve({ default: ping })),
  },
}))

const router = os.router({
  ping,
  user: {
    find: os
      .input(z.object({ find: z.number().transform(() => '1') }))
      .func(() => ({ user: { id: 1 } }))
    ,
  },
  lazyPing: os.lazy(() => Promise.resolve({ default: ping })),
  lazyRouter: os.lazy(() => Promise.resolve({
    default: {
      ping,
      lazyPing: os.lazy(() => Promise.resolve({ default: ping })),
      lazyRouter,
    },
  })),
})

it('require procedure match context', () => {
  const osw = os.context<{ auth: boolean, userId: string }>()

  osw.router({
    ping: osw.context<{ auth: boolean }>().func(() => {
      return { pong: 'ping' }
    }),

    lazyPing: os.context<{ auth: boolean }>().lazy(() => Promise.resolve({
      default: osw.context<{ auth: boolean }>().func(() => {
        return { pong: 'ping' }
      }),
    })),

    // @ts-expect-error userId is not match
    ping2: osw.context<{ userId: number }>().func(() => {
      return { name: 'unnoq' }
    }),

    // @ts-expect-error userId is not match
    lazyPing2: os.context<{ userId: number }>().lazy(() => Promise.resolve({
      default: osw.context<{ userId: number }>().func(() => {
        return { pong: 'ping' }
      }),
    })),

    nested: {
      ping: osw.context<{ auth: boolean }>().func(() => {
        return { pong: 'ping' }
      }),

      // @ts-expect-error userId is not match
      ping2: osw.context<{ userId: number }>().func(() => {
        return { name: 'unnoq' }
      }),

      // @ts-expect-error userId is not match
      lazyPing2: os.context<{ userId: number }>().lazy(() => Promise.resolve({
        default: osw.context<{ userId: number }>().func(() => {
          return { pong: 'ping' }
        }),
      })),
    },
  })
})

it('require match contract', () => {
  const pingContract = oc.route({ method: 'GET', path: '/ping' })
  const pongContract = oc.input(z.string()).output(z.string())
  const ping = os.contract(pingContract).func(() => {
    return 'ping'
  })
  const pong = os.contract(pongContract).func(() => {
    return 'pong'
  })

  const contract = oc.router({
    ping: pingContract,
    pong: pongContract,

    nested: oc.router({
      ping: pingContract,
      pong: pongContract,
    }),
  })

  const _1: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong,

    nested: {
      ping,
      pong,
    },
  }

  const _2: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong,

    nested: os.contract(contract.nested).router({
      ping,
      pong,
    }),
  }

  const _3: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong,

    // @ts-expect-error missing nested.ping
    nested: {
      pong,
    },
  }

  const _4: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong,

    nested: {
      ping,
      // @ts-expect-error nested.pong is mismatch
      pong: os.func(() => 'ping'),
    },
  }

  // @ts-expect-error missing pong
  const _5: RouterWithContract<undefined, typeof contract> = {
    ping,

    nested: {
      ping,
      pong,
    },
  }

  const _6: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong: os.lazy(() => Promise.resolve({ default: pong })),

    nested: os.lazy(() => Promise.resolve({
      default: os.contract(contract.nested).router({
        ping,
        pong,
      }),
    })),
  }

  const _7: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong: os.lazy(() => Promise.resolve({ default: pong })),

    nested: os.lazy(() => Promise.resolve({
      // @ts-expect-error missing nested.ping
      default: os.contract(contract.nested).router({
        pong,
      }),
    })),
  }

  const _8: RouterWithContract<undefined, typeof contract> = {
    ping,
    pong,

    // @ts-expect-error missing nested.ping
    nested: os.lazy(() => Promise.resolve({
      default: {
        pong,
      },
    })),
  }

  const _9: RouterWithContract<undefined, typeof contract> = {
    ping,
    // @ts-expect-error mismatch pong
    pong: os.lazy(() => Promise.resolve({ default: ping })),

    nested: os.lazy(() => Promise.resolve({
      default: os.contract(contract.nested).router({
        ping,
        pong,
      }),
    })),
  }
})

it('InferRouterInputs', () => {
  type Inputs = InferRouterInputs<typeof router>

  expectTypeOf<Inputs>().toEqualTypeOf<{
    ping: {
      ping: string
    }
    user: {
      find: {
        find: number
      }
    }
    lazyPing: {
      ping: string
    }
    lazyRouter: {
      ping: {
        ping: string
      }
      lazyPing: {
        ping: string
      }
      lazyRouter: {
        ping: {
          ping: string
        }
        lazyPing: {
          ping: string
        }
      }
    }
  }>()
})

it('InferRouterOutputs', () => {
  type Outputs = InferRouterOutputs<typeof router>

  expectTypeOf<Outputs>().toEqualTypeOf<{
    ping: {
      pong: string
    }
    user: {
      find: {
        user: {
          id: number
        }
      }
    }
    lazyPing: {
      pong: string
    }
    lazyRouter: {
      ping: {
        pong: string
      }
      lazyPing: {
        pong: string
      }
      lazyRouter: {
        ping: {
          pong: string
        }
        lazyPing: {
          pong: string
        }
      }
    }
  }>()
})
