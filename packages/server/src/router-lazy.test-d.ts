import { z } from 'zod'
import { os } from '.'
import { createLazyProcedure, decorateLazyProcedure } from './procedure-lazy'
import { createLazyProcedureOrLazyRouter } from './router-lazy'

describe('createLazyProcedureOrLazyRouter', () => {
  const procedure = os.input(z.string()).func(() => 'test')
  const procedureWithContext = os.context<{ auth: boolean }>().func(() => 'test')
  const lazy = createLazyProcedure(() => Promise.resolve(procedure))
  const lazyWithContext = createLazyProcedure(() => Promise.resolve(procedureWithContext))
  const decorated = decorateLazyProcedure(lazy)
  const decoratedWithContext = decorateLazyProcedure(lazyWithContext)

  const collection = {
    procedure,
    procedureWithContext,
    lazy,
    lazyWithContext,
    decorated,
    decoratedWithContext,
  }

  const router = {
    ...collection,
    nested: collection,

    lazyRouter: createLazyProcedureOrLazyRouter(() => Promise.resolve({
      ...collection,
      nested: collection,
    })),
  }

  it('should create a lazy procedure', () => {
    const _lazy = createLazyProcedureOrLazyRouter(() => Promise.resolve(procedure))
    expectTypeOf(_lazy).toMatchTypeOf<typeof lazy>()
    expectTypeOf(_lazy).toMatchTypeOf<typeof decorated>()

    const _lazyWithContext = createLazyProcedureOrLazyRouter(() => Promise.resolve(procedureWithContext))
    expectTypeOf(_lazyWithContext).toMatchTypeOf<typeof lazyWithContext>()
    expectTypeOf(_lazyWithContext).toEqualTypeOf<typeof decoratedWithContext>()
  })

  it('should create a lazy router', () => {
    const _lazy = createLazyProcedureOrLazyRouter(() => Promise.resolve(router))

    expectTypeOf(_lazy.lazy).toMatchTypeOf<typeof lazy>()
    expectTypeOf(_lazy.lazyWithContext).toMatchTypeOf<typeof lazyWithContext>()
    expectTypeOf(_lazy.decorated).toEqualTypeOf<typeof decorated>()
    expectTypeOf(_lazy.decoratedWithContext).toEqualTypeOf<typeof decoratedWithContext>()

    expectTypeOf(_lazy.nested.lazy).toMatchTypeOf<typeof lazy>()
    expectTypeOf(_lazy.nested.lazyWithContext).toMatchTypeOf<typeof lazyWithContext>()
    expectTypeOf(_lazy.nested.decorated).toEqualTypeOf<typeof decorated>()
    expectTypeOf(_lazy.nested.decoratedWithContext).toEqualTypeOf<typeof decoratedWithContext>()

    expectTypeOf(_lazy.lazyRouter.lazy).toMatchTypeOf<typeof lazy>()
    expectTypeOf(_lazy.lazyRouter.lazyWithContext).toMatchTypeOf<typeof lazyWithContext>()
    expectTypeOf(_lazy.lazyRouter.decorated).toEqualTypeOf<typeof decorated>()
    expectTypeOf(_lazy.lazyRouter.decoratedWithContext).toEqualTypeOf<typeof decoratedWithContext>()

    expectTypeOf(_lazy.lazyRouter.nested.lazy).toMatchTypeOf<typeof lazy>()
    expectTypeOf(_lazy.lazyRouter.nested.lazyWithContext).toMatchTypeOf<typeof lazyWithContext>()
    expectTypeOf(_lazy.lazyRouter.nested.decorated).toEqualTypeOf<typeof decorated>()
    expectTypeOf(_lazy.lazyRouter.nested.decoratedWithContext).toEqualTypeOf<typeof decoratedWithContext>()
  })
})
