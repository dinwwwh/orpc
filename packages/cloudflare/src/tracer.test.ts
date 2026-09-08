import type { Tracer } from '@orpc/shared'
import { getTracer, setTracer } from '@orpc/shared'
import { tracing } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CloudflareSpan, experimental_CloudflareTracer as CloudflareTracer } from './tracer'

function createFakeSpan() {
  return {
    isTraced: true,
    setAttribute: vi.fn().mockReturnThis(),
    setAttributes: vi.fn().mockReturnThis(),
    recordException: vi.fn(),
    end: vi.fn(),
  }
}

function createFakeTracing(span = createFakeSpan()) {
  return {
    span,
    enterSpan: vi.fn((_name: string, callback: (span: any) => unknown) => callback(span)),
    startActiveSpan: vi.fn(),
    startSpan: vi.fn(() => span),
    getActiveSpan: vi.fn(() => span),
  }
}

describe('cloudflareTracer', () => {
  afterEach(() => {
    setTracer(undefined)
  })

  it('enables and disables itself as the oRPC tracer', () => {
    const tracer = new CloudflareTracer(createFakeTracing() as any)

    tracer.enable()
    expect(getTracer()).toBe(tracer)

    tracer.disable()
    expect(getTracer()).toBeUndefined()
  })

  it('starts active spans with enterSpan', async () => {
    const fake = createFakeTracing()
    const tracer = new CloudflareTracer(fake as any)

    const result = await tracer.startActiveSpan('name', undefined, async (span) => {
      expect(span).toBeInstanceOf(CloudflareSpan)
      expect((span as CloudflareSpan).span).toBe(fake.span)
      return 'out'
    })

    expect(result).toBe('out')
    expect(fake.enterSpan).toHaveBeenCalledWith('name', expect.any(Function))
  })

  it('starts detached spans with startSpan', () => {
    const fake = createFakeTracing()
    const tracer = new CloudflareTracer(fake as any)

    const span = tracer.startSpan('name') as CloudflareSpan
    expect(span.span).toBe(fake.span)
    expect(fake.startSpan).toHaveBeenCalledWith('name')

    span.end()
    expect(fake.span.end).toHaveBeenCalledTimes(1)
  })

  it('returns the active span', () => {
    const fake = createFakeTracing()
    const tracer = new CloudflareTracer(fake as any)

    expect((tracer.getActiveSpan() as CloudflareSpan).span).toBe(fake.span)

    fake.getActiveSpan.mockReturnValue(undefined as any)
    expect(tracer.getActiveSpan()).toBeUndefined()
  })

  it('runs the callback directly for withActiveSpan', async () => {
    const tracer = new CloudflareTracer(createFakeTracing() as any)
    const span = tracer.startSpan('name')

    expect(tracer.withActiveSpan(span, () => 'out')).toBe('out')
  })

  it('has no propagation methods', () => {
    const tracer: Tracer = new CloudflareTracer(createFakeTracing() as any)
    expect(tracer.inject).toBeUndefined()
    expect(tracer.extract).toBeUndefined()
  })

  describe('span', () => {
    it('sets primitive attributes as is and serializes arrays', () => {
      const fake = createFakeSpan()
      const span = new CloudflareSpan(fake as any)

      span.setAttribute('string', 'value')
      span.setAttribute('number', 1)
      span.setAttribute('boolean', true)
      span.setAttribute('array', ['a', 'b'])

      expect(fake.setAttribute).toHaveBeenNthCalledWith(1, 'string', 'value')
      expect(fake.setAttribute).toHaveBeenNthCalledWith(2, 'number', 1)
      expect(fake.setAttribute).toHaveBeenNthCalledWith(3, 'boolean', true)
      expect(fake.setAttribute).toHaveBeenNthCalledWith(4, 'array', '["a","b"]')
    })

    it('ignores renames and events', () => {
      const fake = createFakeSpan()
      const span = new CloudflareSpan(fake as any)

      span.updateName('renamed')
      span.addEvent('event')

      expect(fake.setAttribute).not.toHaveBeenCalled()
      expect(fake.end).not.toHaveBeenCalled()
    })

    it('records error level exceptions natively', () => {
      const fake = createFakeSpan()
      const span = new CloudflareSpan(fake as any)
      const exception = { name: 'TypeError', message: 'boom', stack: 'stack', code: 'CODE' }

      span.recordException('error', exception)

      expect(fake.recordException).toHaveBeenCalledWith(exception)
      expect(fake.setAttributes).not.toHaveBeenCalled()
    })

    it('keeps info level exceptions as attributes', () => {
      const fake = createFakeSpan()
      const span = new CloudflareSpan(fake as any)

      span.recordException('info', { name: 'AbortError', message: 'aborted', stack: 'stack' })

      expect(fake.recordException).not.toHaveBeenCalled()
      expect(fake.setAttributes).toHaveBeenCalledWith({
        'exception.type': 'AbortError',
        'exception.message': 'aborted',
        'exception.stacktrace': 'stack',
      })
    })
  })

  /**
   * The vitest workers pool still bundles a workerd without getActiveSpan and recordException,
   * so only the older methods run against the real runtime here.
   */
  describe('with the runtime tracing api', () => {
    it('records spans without throwing', async () => {
      const tracer = new CloudflareTracer(tracing)

      const result = await tracer.startActiveSpan('active', undefined, async (span) => {
        span.setAttribute('key', 'value')
        span.setAttribute('path', ['a', 'b'])
        span.updateName('renamed')
        span.addEvent('event')
        span.recordException('info', { name: 'AbortError', message: 'aborted' })

        const detached = tracer.startSpan('detached')
        detached.end()

        expect(tracer.withActiveSpan(span, () => 'inner')).toBe('inner')

        span.end()
        return 'out'
      })

      expect(result).toBe('out')
    })

    it('rethrows errors from active spans', async () => {
      const tracer = new CloudflareTracer(tracing)

      await expect(tracer.startActiveSpan('failing', undefined, async () => {
        throw new Error('boom')
      })).rejects.toThrow('boom')
    })
  })
})
