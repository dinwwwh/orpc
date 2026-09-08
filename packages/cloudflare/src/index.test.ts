import { expect, it } from 'vitest'

it('exports CloudflareRateLimiter, experimental_CloudflareSpan, experimental_CloudflareTracer, DurablePublisher, DurablePublisherObject', async () => {
  await expect(import('./index')).resolves.toMatchObject({
    CloudflareRateLimiter: expect.any(Function),
    experimental_CloudflareSpan: expect.any(Function),
    experimental_CloudflareTracer: expect.any(Function),
    DurablePublisher: expect.any(Function),
    DurablePublisherObject: expect.any(Function),
  })
})
