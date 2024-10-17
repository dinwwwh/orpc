import { orpcClient } from '../../tests/orpc'
import { createUseQueriesBuilder } from './builder'
import { createUseQueriesBuilders } from './builders'

it('createUseQueriesBuilders', () => {
  const builder = createUseQueriesBuilders({
    client: orpcClient,
  })

  expectTypeOf(builder.user.find).toEqualTypeOf(
    createUseQueriesBuilder({
      client: orpcClient.user.find,
      path: ['user', 'find'],
    }),
  )

  expectTypeOf(builder.user.list).toEqualTypeOf(
    createUseQueriesBuilder({
      client: orpcClient.user.list,
      path: ['user', 'list'],
    }),
  )

  expectTypeOf(builder.ping).toEqualTypeOf(
    createUseQueriesBuilder({
      client: orpcClient.ping,
      path: ['ping'],
    }),
  )
})
