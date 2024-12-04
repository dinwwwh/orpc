import { z } from 'zod'
import { os } from '.'
import { createLazyProcedure, decorateLazyProcedure, isLazyProcedure } from './procedure-lazy'
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
    expect(_lazy).toSatisfy(isLazyProcedure)
    expect(_lazy('test')).resolves.toBe('test')
  })

  it('should create a lazy router', () => {
    const _lazy = createLazyProcedureOrLazyRouter(() => Promise.resolve(router))

    expect(_lazy.lazy).toSatisfy(isLazyProcedure)
    expect(_lazy.lazy('test')).resolves.toBe('test')
    expect(_lazy.decorated).toSatisfy(isLazyProcedure)
    expect(_lazy.decorated('test')).resolves.toBe('test')

    expect(_lazy.lazyWithContext).toSatisfy(isLazyProcedure)
    expect(_lazy.decoratedWithContext).toSatisfy(isLazyProcedure)

    expect(_lazy.nested.lazy).toSatisfy(isLazyProcedure)
    expect(_lazy.nested.lazy('test')).resolves.toBe('test')
    expect(_lazy.nested.decorated).toSatisfy(isLazyProcedure)
    expect(_lazy.nested.decorated('test')).resolves.toBe('test')

    expect(_lazy.nested.lazyWithContext).toSatisfy(isLazyProcedure)
    expect(_lazy.nested.decoratedWithContext).toSatisfy(isLazyProcedure)

    expect(_lazy.lazyRouter.lazy).toSatisfy(isLazyProcedure)
    expect(_lazy.lazyRouter.lazy('test')).resolves.toBe('test')
    expect(_lazy.lazyRouter.decorated).toSatisfy(isLazyProcedure)
    expect(_lazy.lazyRouter.decorated('test')).resolves.toBe('test')

    expect(_lazy.lazyRouter.lazyWithContext).toSatisfy(isLazyProcedure)
    expect(_lazy.lazyRouter.decoratedWithContext).toSatisfy(isLazyProcedure)

    expect(_lazy.lazyRouter.nested.lazy).toSatisfy(isLazyProcedure)
    expect(_lazy.lazyRouter.nested.lazy('test')).resolves.toBe('test')
    expect(_lazy.lazyRouter.nested.decorated).toSatisfy(isLazyProcedure)
    expect(_lazy.lazyRouter.nested.decorated('test')).resolves.toBe('test')

    expect(_lazy.lazyRouter.nested.lazyWithContext).toSatisfy(isLazyProcedure)
    expect(_lazy.lazyRouter.nested.decoratedWithContext).toSatisfy(isLazyProcedure)
  })

  it('lazy router every level satisfy isLazyProcedure', () => {
    const _lazy = createLazyProcedureOrLazyRouter(() => Promise.resolve(router))

    expect(_lazy.nested).toSatisfy(isLazyProcedure)
    // @ts-expect-error - not exists
    expect(_lazy.nested.not_exists.not_exists).toSatisfy(isLazyProcedure)

    // @ts-expect-error - invalid
    expect(_lazy.nested()).rejects.toThrowError('The loaded procedure is not a valid procedure')

    // @ts-expect-error -invalid
    expect(_lazy.nested.not_exists.not_exists()).rejects.toThrowError('The loader reached the end of the chain')
  })
})
