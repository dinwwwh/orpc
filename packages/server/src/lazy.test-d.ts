import { z } from 'zod'
import { os } from '.'
import { createLazy, decorateLazy } from './lazy'

const router = {
  ping: os.input(z.string()).func(() => 'pong'),
  pong: os.func(() => 'ping'),
}
const lazyPing = createLazy(() => Promise.resolve({ default: router.ping }))
const lazyPong = createLazy(() => Promise.resolve({ default: router.pong }))
const lazyRouter = createLazy(() => Promise.resolve({ default: router }))
const nestedLazyRouter = createLazy(() => Promise.resolve({ default: lazyRouter }))
const complexLazyRouter = createLazy(() => Promise.resolve({ default: {
  nestedLazyRouter,
} }))

describe('DecoratedLazy', () => {
  it('with procedure', () => {
    const decorated = decorateLazy(lazyPing)

    expectTypeOf(decorated).toMatchTypeOf<
      (input: string) => Promise<string>
    >()

    expectTypeOf(decorated('test')).toMatchTypeOf<Promise<string>>()
  })

  it('with router', () => {
    const decorated = decorateLazy(lazyRouter)

    expectTypeOf(decorated).toMatchTypeOf<{
      ping: (input: string) => Promise<string>
      pong: () => Promise<string>
    }>()

    expectTypeOf(decorated.ping).toMatchTypeOf<(input: string) => Promise<string>>()
    expectTypeOf(decorated.ping('test')).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.pong).toMatchTypeOf<() => Promise<string>>()
    expectTypeOf(decorated.pong()).toMatchTypeOf<Promise<string>>()
  })

  it('with nested router', () => {
    const decorated = decorateLazy(nestedLazyRouter)

    expectTypeOf(decorated).toMatchTypeOf<{
      ping: (input: string) => Promise<string>
      pong: () => Promise<string>
    }>()

    expectTypeOf(decorated.ping).toMatchTypeOf<(input: string) => Promise<string>>()
    expectTypeOf(decorated.ping('test')).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.pong).toMatchTypeOf<() => Promise<string>>()
    expectTypeOf(decorated.pong()).toMatchTypeOf<Promise<string>>()
  })

  it('with complex router', () => {
    const decorated = decorateLazy(complexLazyRouter)

    const b = decorated

    expectTypeOf(decorated).toMatchTypeOf<{
      ping: (input: string) => Promise<string>
      pong: () => Promise<string>
    }>()

    expectTypeOf(decorated.ping).toMatchTypeOf<(input: string) => Promise<string>>()
    expectTypeOf(decorated.ping('test')).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.pong).toMatchTypeOf<() => Promise<string>>()
    expectTypeOf(decorated.pong()).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.lazyRouter).toMatchTypeOf<{
      ping: (input: string) => Promise<string>
      pong: () => Promise<string>
    }>()

    expectTypeOf(decorated.lazyRouter.ping).toMatchTypeOf<(input: string) => Promise<string>>()
    expectTypeOf(decorated.lazyRouter.ping('test')).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.lazyRouter.pong).toMatchTypeOf<() => Promise<string>>()
    expectTypeOf(decorated.lazyRouter.pong()).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.nestedLazyRouter).toMatchTypeOf<{
      ping: (input: string) => Promise<string>
      pong: () => Promise<string>
    }>()

    expectTypeOf(decorated.nestedLazyRouter.ping).toMatchTypeOf<(input: string) => Promise<string>>()
    expectTypeOf(decorated.nestedLazyRouter.ping('test')).toMatchTypeOf<Promise<string>>()

    expectTypeOf(decorated.nestedLazyRouter.pong).toMatchTypeOf<() => Promise<string>>()
    expectTypeOf(decorated.nestedLazyRouter.pong()).toMatchTypeOf<Promise<string>>()
  })
})
