import { z } from 'zod'
import { os } from '.'
import {
  createLazyProcedure,
  decorateLazyProcedure,
  isLazyProcedure,
  LAZY_PROCEDURE_LOADER_SYMBOL,
} from './procedure-lazy'

describe('createLazyProcedure', () => {
  it('should create a lazy procedure with the correct symbol', () => {
    const mockLoader = vi.fn()
    const lazyProcedure = createLazyProcedure(mockLoader)

    expect(lazyProcedure).toSatisfy(isLazyProcedure)
    expect(typeof lazyProcedure[LAZY_PROCEDURE_LOADER_SYMBOL]).toBe('function')
    expect(lazyProcedure[LAZY_PROCEDURE_LOADER_SYMBOL]).toBe(mockLoader)
  })
})

describe('isLazyProcedure', () => {
  it('should return true for a valid lazy procedure', () => {
    const mockLoader = vi.fn()
    const lazyProcedure = createLazyProcedure(mockLoader)

    expect(isLazyProcedure(lazyProcedure)).toBe(true)
  })

  it('should return false for non-lazy procedures', () => {
    expect(isLazyProcedure(null)).toBe(false)
    expect(isLazyProcedure(undefined)).toBe(false)
    expect(isLazyProcedure({})).toBe(false)
    expect(isLazyProcedure({ someRandomProperty: 'test' })).toBe(false)
  })
})

describe('decorateLazyProcedure', () => {
  const procedure = os.input(z.string()).func(() => 'test')
  const procedureWithContext = os.context<{ auth: boolean }>().func(() => 'test')
  const lazy = createLazyProcedure(() => Promise.resolve(procedure))
  const lazyWithContext = createLazyProcedure(() => Promise.resolve(procedureWithContext))
  const decorated = decorateLazyProcedure(lazy)
  const decoratedWithContext = decorateLazyProcedure(lazyWithContext)

  it('still a lazy procedure', () => {
    expect(decorated).toSatisfy(isLazyProcedure)
    expect(decoratedWithContext).toSatisfy(isLazyProcedure)
  })

  it('callable', () => {
    expect(decorated('test')).resolves.toBe('test')

    // @ts-expect-error - invalid input
    expect(decorated({})).rejects.toThrowError('Validation input failed')
  })
})
