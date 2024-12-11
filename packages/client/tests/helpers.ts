import { os } from '@orpc/server'
import { createORPCHandler, handleFetchRequest } from '@orpc/server/fetch'
import { z } from 'zod'
import { createORPCClient } from '../src'

export const orpcServer = os

export const ping = orpcServer.func(() => 'pong')

export const UserSchema = z
  .object({ data: z.object({ id: z.string(), name: z.string() }) })
  .transform(data => data.data)
export const UserFindInputSchema = z
  .object({ id: z.string() })
  .transform(data => ({ data }))

export const userFind = orpcServer
  .input(UserFindInputSchema)
  .output(UserSchema)
  .func((input) => {
    return {
      data: {
        id: input.data.id,
        name: `name-${input.data.id}`,
      },
    }
  })

export const UserListInputSchema = z
  .object({
    keyword: z.string().optional(),
    cursor: z.number().default(0),
  })
  .transform(data => ({ data }))
export const UserListOutputSchema = z
  .object({
    data: z.object({
      nextCursor: z.number(),
      users: z.array(UserSchema),
    }),
  })
  .transform(data => data.data)
export const userList = orpcServer
  .input(UserListInputSchema)
  .output(UserListOutputSchema)
  .func((input) => {
    return {
      data: {
        nextCursor: input.data.cursor + 2,
        users: [
          {
            data: {
              id: `id-${input.data.cursor}`,
              name: `number-${input.data.cursor}`,
            },
          },
          {
            data: {
              id: `id-${input.data.cursor + 1}`,
              name: `number-${input.data.cursor + 1}`,
            },
          },
        ],
      },
    }
  })

export const UserCreateInputSchema = z
  .object({ name: z.string() })
  .transform(data => ({ data }))
export const userCreate = orpcServer
  .input(UserCreateInputSchema)
  .output(UserSchema)
  .func((input) => {
    return {
      data: {
        id: '28aa6286-48e9-4f23-adea-3486c86acd55',
        name: input.data.name,
      },
    }
  })

const countFileSize = os.input(z.instanceof(Blob)).func((input) => {
  return input.size
})

export const appRouter = orpcServer.router({
  ping,
  user: {
    find: userFind,
    list: userList,
    create: userCreate,
  },
  nested: {
    countFileSize,
  },
})

export const client = createORPCClient<typeof appRouter>({
  baseURL: 'http://localhost:3000',

  async fetch(...args) {
    await new Promise(resolve => setTimeout(resolve, 100))
    const request = new Request(...args)

    return handleFetchRequest({
      router: appRouter,
      request,
      handlers: [createORPCHandler()],
    })
  },
})