import { createORPCFetchClient } from '@orpc/client'
import { createORPCVueQueryUtils } from '@orpc/vue-query'
import type { router } from '~/server/router'

export const client = createORPCFetchClient<typeof router>({
  baseURL: 'http://localhost:3000/api',
  headers: () => ({
    Authorization: 'Bearer default-token',
  }),
})

export const orpc = createORPCVueQueryUtils(client)
