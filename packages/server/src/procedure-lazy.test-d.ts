import type { ANY_FUNCTION } from '@orpc/shared'
import { z } from 'zod'
import { os } from '.'
import { createLazyProcedure, decorateLazyProcedure } from './procedure-lazy'

describe('decorateLazyProcedure', () => {
  const procedure = os.input(z.string()).func(() => 'test')
  const procedureWithContext = os.context<{ auth: boolean }>().func(() => 'test')
  const lazy = createLazyProcedure(() => Promise.resolve(procedure))
  const lazyWithContext = createLazyProcedure(() => Promise.resolve(procedureWithContext))
  const decorated = decorateLazyProcedure(lazy)
  const decoratedWithContext = decorateLazyProcedure(lazyWithContext)

  it('still a lazy procedure', () => {
    expectTypeOf(decorated).toMatchTypeOf(lazy)
    expectTypeOf(decoratedWithContext).toMatchTypeOf(decoratedWithContext)
  })

  it('callable without context', () => {
    decorated('test')
    expectTypeOf(decorated).toMatchTypeOf<
      (input: string) => Promise<string>
    >()
  })

  it('is not callable with context', () => {
    // @ts-expect-error - cannot call directly without context
    decoratedWithContext({} as any)
    expectTypeOf(decoratedWithContext).not.toMatchTypeOf<ANY_FUNCTION>()
  })
})
