import { ORPCError } from '@orpc/shared/error'

export const ERROR_LAZY_LOADER_INVALID_PROCEDURE = new ORPCError({
  code: 'NOT_FOUND',
  message: 'Not found',
  cause: new Error('The loaded procedure is not a valid procedure'),
})

export const ERROR_ROUTER_REACHED_END = new ORPCError({
  code: 'NOT_FOUND',
  message: 'Not found',
  cause: new Error('The loader reached the end of the chain'),
})
