export interface Context {
  [key: PropertyKey]: any
}

/**
 * Like `Omit`, but distributes over unions and keeps known keys beside index signatures.
 */
type OmitKeys<T, K extends PropertyKey> = { [P in keyof T as P extends K ? never : P]: T[P] }

export type MergedInitialContext<
  TInitial extends Context,
  TOutContext extends Context,
  TInContext extends Context,
> = TInContext extends any
  ? Exclude<keyof TInContext, keyof TInitial | keyof TOutContext> extends never
    ? TInitial
    : TInitial & OmitKeys<TInContext, keyof TInitial | keyof TOutContext>
  : never

export type MergedContext<
  TCurrent extends Context,
  TOutContext extends Context,
> = keyof TOutContext extends never
  ? TCurrent
  : OmitKeys<TCurrent, keyof TOutContext> & TOutContext
