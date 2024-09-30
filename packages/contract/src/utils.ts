import { HTTPPath, PrefixHTTPPath, StandardizeHTTPPath } from './types'

export function standardizeHTTPPath<T extends HTTPPath>(path: T): StandardizeHTTPPath<T> {
  if (path === undefined) return path as any

  return `/${path.replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '')}` as any
}

export function prefixHTTPPath<
  TPrefix extends Exclude<HTTPPath, undefined>,
  TPath extends HTTPPath
>(prefix: TPrefix, path: TPath): PrefixHTTPPath<TPrefix, TPath> {
  if (path === undefined) return path as any

  const prefix_ = standardizeHTTPPath(prefix)
  const path_ = standardizeHTTPPath(path)

  if (prefix_ === '/') return path_ as any
  if (path_ === '/') return prefix_ as any

  return `${prefix_}${path_}` as any
}