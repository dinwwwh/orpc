import type { Middleware } from '@orpc/server'
import type { RateLimitMiddlewareOptions } from './middleware'
import type { RateLimiter } from './types'
import { os, type } from '@orpc/server'
import { ratelimit } from './middleware'

describe('ratelimit', () => {
  it('can infer context & input & meta types', () => {
    const procedure = os
      .$context<{ userId: string, rateLimiter: RateLimiter }>()
      .input(type<{ amount: number }>())
      .use(({ next }) => {
        return next({
          context: {
            db: 'postgres',
          },
        })
      })
      .use(
        ratelimit({
          limiter: async ({ context }, input) => {
            expectTypeOf(input.amount).toBeNumber()
            expectTypeOf(context.userId).toBeString()
            expectTypeOf(context.db).toBeString()

            return context.rateLimiter
          },
          key: ({ context }, input) => {
            expectTypeOf(input.amount).toBeNumber()
            expectTypeOf(context.userId).toBeString()
            expectTypeOf(context.db).toBeString()

            return context.userId
          },
          weight: ({ context }, input) => {
            expectTypeOf(input.amount).toBeNumber()
            expectTypeOf(context.userId).toBeString()
            expectTypeOf(context.db).toBeString()

            return 1
          },
        }),
      )
      .handler(({ context, input }) => {
        expectTypeOf(context.rateLimiter).toEqualTypeOf<RateLimiter>()
        expectTypeOf(context.userId).toBeString()
        expectTypeOf(context.db).toBeString()
        expectTypeOf(input.amount).toBeNumber()

        return 'ok'
      })
  })
})

describe('ratelimit standalone', () => {
  it('only requires the context type argument when defined standalone', () => {
    const byUser = ratelimit<{ userId: string, rateLimiter: RateLimiter }>({
      limiter: ({ context }) => context.rateLimiter,
      key: ({ context }, input) => {
        expectTypeOf(input).toBeUnknown()
        return context.userId
      },
    })

    expectTypeOf(byUser).toEqualTypeOf<Middleware<{ userId: string, rateLimiter: RateLimiter }, object, unknown, any, object>>()

    os
      .$context<{ userId: string, rateLimiter: RateLimiter }>()
      .input(type<{ amount: number }>())
      .use(byUser)
      .handler(({ context, input }) => {
        expectTypeOf(context.userId).toBeString()
        expectTypeOf(input.amount).toBeNumber()
      })

    // @ts-expect-error - context is missing rateLimiter
    os.$context<{ userId: string }>().use(byUser)
  })

  it('options type defaults input to unknown', () => {
    const options: RateLimitMiddlewareOptions<{ rateLimiter: RateLimiter }> = {
      limiter: ({ context }) => context.rateLimiter,
      key: (_, input) => {
        expectTypeOf(input).toBeUnknown()
        return 'key'
      },
    }

    os.$context<{ rateLimiter: RateLimiter }>().use(ratelimit(options))
  })
})
