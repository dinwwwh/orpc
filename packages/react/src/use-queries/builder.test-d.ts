import type { Promisable } from '@orpc/server'
import { orpcClient } from '../../tests/orpc'
import { createUseQueriesBuilder } from './builder'

it('createUseQueriesBuilder', () => {
  const builder = createUseQueriesBuilder({
    client: orpcClient.user.find,
    path: ['user', 'find'],
  })

  expectTypeOf<Parameters<typeof builder>[0]>().toEqualTypeOf<{
    id: string
  }>()

  const result = builder({ id: '123' }, { throwOnError: true })

  builder({ id: '123' })
  //   @ts-expect-error invalid input
  builder({ id: 123 })

  if (typeof result.queryFn === 'function') {
    expectTypeOf(result.queryFn({} as any)).toEqualTypeOf<
      Promisable<{
        id: string
        name: string
      }>
    >()
  }
})
