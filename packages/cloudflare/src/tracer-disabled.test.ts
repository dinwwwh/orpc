import { getTracer, setTracer } from '@orpc/shared'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return { ...original, tracing: undefined }
})

afterEach(() => {
  setTracer(undefined)
})

it('enable does nothing when the runtime exposes no tracing api', async () => {
  const { experimental_CloudflareTracer: CloudflareTracer } = await import('./tracer')

  new CloudflareTracer().enable()
  expect(getTracer()).toBeUndefined()
})
