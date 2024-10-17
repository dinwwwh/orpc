import { orpcClient } from '../../tests/orpc'
import { createUseQueriesBuilder } from './builder'
import { createUseQueriesBuilders } from './builders'

it('createUseQueriesBuilders', async () => {
  const builder = createUseQueriesBuilders({
    client: orpcClient,
  })

  const e1 = builder.user.find({ id: '123' })
  const a1 = createUseQueriesBuilder({
    client: orpcClient.user.find,
    path: ['user', 'find'],
  })({ id: '123' })

  expect(e1.queryKey).toEqual(a1.queryKey)

  expect(await (e1 as any).queryFn()).toEqual(await (a1 as any).queryFn())

  const e2 = builder.user.list({})
  const a2 = createUseQueriesBuilder({
    client: orpcClient.user.list,
    path: ['user', 'list'],
  })({})

  expect(e2.queryKey).toEqual(a2.queryKey)

  expect(await (e2 as any).queryFn()).toEqual(await (a2 as any).queryFn())
})
