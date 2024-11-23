import { oc } from '@orpc/contract'
import { CredentialSchema, TokenSchema } from '../schemas/auth'
import { NewUserSchema, UserSchema } from '../schemas/user'

export const signup = oc
  .route({
    method: 'POST',
    path: '/signup',
    summary: 'Sign up a new user',
  })
  .input(NewUserSchema)
  .output(UserSchema)

export const signin = oc
  .route({
    method: 'POST',
    path: '/signin',
    summary: 'Sign in a user',
  })
  .input(CredentialSchema)
  .output(TokenSchema)

export const refresh = oc
  .route({
    method: 'POST',
    path: '/refresh',
    summary: 'Refresh a token',
  })
  .output(TokenSchema)

export const revoke = oc
  .route({
    method: 'DELETE',
    path: '/revoke',
    summary: 'Revoke a token',
  })
  .input(TokenSchema)

export const me = oc
  .route({
    method: 'GET',
    path: '/me',
    summary: 'Get the current user',
  })
  .output(UserSchema)
