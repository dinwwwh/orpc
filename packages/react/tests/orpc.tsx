import { createORPCClient } from '@orpc/client'
import { createRouterHandler, initORPC } from '@orpc/server'
import { fetchHandler } from '@orpc/server/fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { z } from 'zod'
import { createORPCReact } from '../src'

export const orpcServer = initORPC

export const ping = orpcServer.handler(() => 'pong')

export const UserSchema = z
  .object({ data: z.object({ id: z.string(), name: z.string() }) })
  .transform((data) => data.data)
export const UserFindInputSchema = z
  .object({ id: z.string() })
  .transform((data) => ({ data }))

export const userFind = orpcServer
  .input(UserFindInputSchema)
  .output(UserSchema)
  .handler((input) => {
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
  .transform((data) => ({ data }))
export const UserListOutputSchema = z
  .object({
    data: z.object({
      nextCursor: z.number(),
      users: z.array(UserSchema),
    }),
  })
  .transform((data) => data.data)
export const userList = orpcServer
  .input(UserListInputSchema)
  .output(UserListOutputSchema)
  .handler((input) => {
    return {
      data: {
        nextCursor: input.data.cursor + 2,
        users: [
          {
            data: {
              id: crypto.randomUUID(),
              name: `number-${input.data.cursor}`,
            },
          },
          {
            data: {
              id: crypto.randomUUID(),
              name: `number-${input.data.cursor + 1}`,
            },
          },
        ],
      },
    }
  })

export const UserCreateInputSchema = z
  .object({ name: z.string() })
  .transform((data) => ({ data }))
export const userCreate = orpcServer
  .input(UserCreateInputSchema)
  .output(UserSchema)
  .handler((input) => {
    return {
      data: {
        id: crypto.randomUUID(),
        name: input.data.name,
      },
    }
  })

export const appRouter = orpcServer.router({
  ping,
  user: {
    find: userFind,
    list: userList,
    create: userCreate,
  },
})

export const appRouterHandler = createRouterHandler({ router: appRouter })

export const orpcClient = createORPCClient<typeof appRouter>({
  baseURL: 'http://localhost:3000',

  fetch(...args) {
    const request = new Request(...args)

    return fetchHandler({
      request,
      handler: appRouterHandler,
      context: undefined,
    })
  },
})

export const { orpc, ORPCContext } = createORPCReact<typeof appRouter>()

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

export const wrapper = (props: { children: React.ReactNode }) => {
  return (
    <ORPCContext.Provider value={{ client: orpcClient, queryClient }}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </ORPCContext.Provider>
  )
}
