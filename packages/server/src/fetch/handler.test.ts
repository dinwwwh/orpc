import { ORPC_HEADER, ORPC_HEADER_VALUE } from '@orpc/contract'
import { z } from 'zod'
import { os } from '..'
import { createORPCHandler } from './handler'

describe('oRPCHandler', () => {
  const handler = createORPCHandler()

  const ping = os.input(z.object({ value: z.string() })).output(z.string()).func((input) => {
    return input.value
  })
  const pong = os.func(() => 'pong')

  const lazyRouter = os.lazy(() => Promise.resolve({
    default: {
      ping: os.lazy(() => Promise.resolve({ default: ping })),
      pong,
      lazyRouter: os.lazy(() => Promise.resolve({ default: { ping, pong } })),
    },
  }))

  const router = os.router({
    ping,
    pong,
    lazyRouter,
  })

  it('should handle request', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/ping', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { value: '123' }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(200)
    expect(await response?.json()).toEqual({ data: '123', meta: [] })
  })

  it('should handle request - lazy', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/lazyRouter/ping', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { value: '123' }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(200)
    expect(await response?.json()).toEqual({ data: '123', meta: [] })
  })

  it('should handle request - lazy - lazy', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/lazyRouter/lazyRouter/ping', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { value: '123' }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(200)
    expect(await response?.json()).toEqual({ data: '123', meta: [] })
  })

  it('should throw error - not found', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/pingp', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
        },
        body: JSON.stringify({ data: { value: '123' }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(404)
    expect(await response?.json()).toEqual({ data: { code: 'NOT_FOUND', message: 'Not found', status: 404 }, meta: [] })
  })

  it('should throw error - invalid input', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/ping', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
        },
        body: JSON.stringify({ data: { value: 123 }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(400)
    expect(await response?.json()).toEqual({
      data: {
        code: 'BAD_REQUEST',
        status: 400,
        message: 'Validation input failed',
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: [
              'value',
            ],
            message: 'Expected string, received number',
          },
        ],
      },
      meta: [],
    })
  })

  it('should throw error - invalid input - lazy', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/lazyRouter/ping', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
        },
        body: JSON.stringify({ data: { value: 123 }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(400)
    expect(await response?.json()).toEqual({
      data: {
        code: 'BAD_REQUEST',
        status: 400,
        message: 'Validation input failed',
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: [
              'value',
            ],
            message: 'Expected string, received number',
          },
        ],
      },
      meta: [],
    })
  })

  it('should throw error - invalid input - lazy - lazy', async () => {
    const response = await handler({
      router,
      request: new Request('http://localhost/lazyRouter/lazyRouter/ping', {
        method: 'POST',
        headers: {
          [ORPC_HEADER]: ORPC_HEADER_VALUE,
        },
        body: JSON.stringify({ data: { value: 123 }, meta: [] }),
      }),
    })

    expect(response?.status).toEqual(400)
    expect(await response?.json()).toEqual({
      data: {
        code: 'BAD_REQUEST',
        status: 400,
        message: 'Validation input failed',
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: [
              'value',
            ],
            message: 'Expected string, received number',
          },
        ],
      },
      meta: [],
    })
  })
})
