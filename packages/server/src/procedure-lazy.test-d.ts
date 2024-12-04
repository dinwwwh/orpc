import type { ANY_FUNCTION } from '@orpc/shared'
import { z } from 'zod'
import { os } from '.'
import { createLazyProcedure, decorateLazyProcedure } from './procedure-lazy'

describe('decorateLazyProcedure', () => {
  const procedure = os.input(z.string()).func(() => 'test')
  const procedureWithContext = os.context<{ auth: boolean }>().func(() => 'test')

  it('callable without context', () => {
    const decorated = decorateLazyProcedure(createLazyProcedure(() => Promise.resolve(procedure)))

    decorated('test')
    expectTypeOf(decorated).toMatchTypeOf<
      (input: string) => Promise<string>
    >()
  })

  it('is not callable with context', () => {
    const decorated = decorateLazyProcedure(createLazyProcedure(() => Promise.resolve(procedureWithContext)))

    // @ts-expect-error - cannot call directly without context
    decorated({} as any)
    expectTypeOf(decorated).not.toMatchTypeOf<ANY_FUNCTION>()
  })
})
