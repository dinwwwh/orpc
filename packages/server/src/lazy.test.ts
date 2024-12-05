import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { os } from '.'
import {
  createFlattenLazy,
  createLazy,
  decorateLazy,
  isLazy,
  LAZY_LOADER_SYMBOL,
  loadLazy,
} from './lazy'

describe('createLazy', () => {
  it('should create a lazy object with a loader function', () => {
    const mockLoader = vi.fn().mockResolvedValue({ default: 'test' })
    const lazyObj = createLazy(mockLoader)

    expect(lazyObj[LAZY_LOADER_SYMBOL]).toBe(mockLoader)
  })
})

describe('loadLazy', () => {
  it('should call the loader function and return the result', async () => {
    const mockLoader = vi.fn().mockResolvedValue({ default: 'loaded value' })
    const lazyObj = createLazy(mockLoader)

    const result = await loadLazy(lazyObj)

    expect(mockLoader).toHaveBeenCalledOnce()
    expect(result).toEqual({ default: 'loaded value' })
  })
})

describe('isLazy', () => {
  it('should return true for a lazy object', () => {
    const lazyObj = createLazy(() => Promise.resolve({ default: 'test' }))
    expect(isLazy(lazyObj)).toBe(true)
  })

  it('should return false for non-lazy objects', () => {
    expect(isLazy(null)).toBe(false)
    expect(isLazy(undefined)).toBe(false)
    expect(isLazy({})).toBe(false)
    expect(isLazy({ someOtherSymbol: () => { } })).toBe(false)
  })
})

describe('createFlattenLazy', () => {
  it('should flatten nested lazy objects', async () => {
    const innerMostLoader = vi.fn().mockResolvedValue({ default: 'final value' })
    const innerLoader = vi.fn().mockResolvedValue({
      default: createLazy(innerMostLoader),
    })
    const outerLoader = vi.fn().mockResolvedValue({
      default: createLazy(innerLoader),
    })

    const flattenedLazy = createFlattenLazy(createLazy(outerLoader))

    const result = await loadLazy(flattenedLazy)

    expect(outerLoader).toHaveBeenCalledOnce()
    expect(innerLoader).toHaveBeenCalledOnce()
    expect(innerMostLoader).toHaveBeenCalledOnce()
    expect(result).toEqual({ default: 'final value' })
  })

  it('should handle single-level lazy objects', async () => {
    const loader = vi.fn().mockResolvedValue({ default: 'simple value' })
    const flattenedLazy = createFlattenLazy(createLazy(loader))

    const result = await loadLazy(flattenedLazy)

    expect(loader).toHaveBeenCalledOnce()
    expect(result).toEqual({ default: 'simple value' })
  })
})

describe('decorateLazy', () => {
  const ping = os.input(z.string()).func(() => 'pong')
  const pong = os.func(() => 'ping')

  const router = {
    ping: createLazy(() => Promise.resolve({ default: ping })),
    pong: createLazy(() => Promise.resolve({ default: pong })),
    nested: {
      ping: createLazy(() => Promise.resolve({ default: ping })),
      pong: createLazy(() => Promise.resolve({ default: pong })),
    },
  }

  it('should create a proxy for nested lazy loading', async () => {
    const decoratedLazy = decorateLazy(createLazy(() => Promise.resolve({ default: router })))

    // Test method access
    const methodResult = await decoratedLazy.ping()
    expect(methodResult).toBe('method result')

    // Test nested method access
    const nestedResult = await decoratedLazy.nestedRouter.deepMethod()
    expect(nestedResult).toBe('deep method result')
  })
})
