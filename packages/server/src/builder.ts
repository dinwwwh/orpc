import type { IsEqual } from '@orpc/shared'
import type { DecoratedProcedure, Procedure, ProcedureFunc } from './procedure'
import type { DecoratedLazyProcedure } from './procedure-lazy'
import type { HandledRouter, Router } from './router'
import type { LazyRouter } from './router-lazy'
import type { Context, MergeContext } from './types'
import {
  ContractProcedure,
  type ContractRouter,
  type HTTPPath,
  isContractProcedure,
  type RouteOptions,
  type Schema,
  type SchemaInput,
  type SchemaOutput,
} from '@orpc/contract'
import {
  type DecoratedMiddleware,
  decorateMiddleware,
  type MapInputMiddleware,
  type Middleware,
} from './middleware'
import { decorateProcedure } from './procedure'
import { ProcedureBuilder } from './procedure-builder'
import { ProcedureImplementer } from './procedure-implementer'
import { RouterBuilder } from './router-builder'
import {
  type ChainedRouterImplementer,
  chainRouterImplementer,
} from './router-implementer'
import { createLazyProcedureOrLazyRouter } from './router-lazy'

export class Builder<TContext extends Context, TExtraContext extends Context> {
  constructor(
    public zz$b: {
      middlewares?: Middleware<any, any, any, any>[]
    } = {},
  ) {}

  /**
   * Self chainable
   */

  context<UContext extends Context>(): IsEqual<UContext, Context> extends true
    ? Builder<TContext, TExtraContext>
    : Builder<UContext, TExtraContext> {
    return this as any
  }

  use<
    UExtraContext extends
    | Partial<MergeContext<Context, MergeContext<TContext, TExtraContext>>>
    | undefined = undefined,
  >(
    middleware: Middleware<
      MergeContext<TContext, TExtraContext>,
      UExtraContext,
      unknown,
      unknown
    >,
  ): Builder<TContext, MergeContext<TExtraContext, UExtraContext>>

  use<
    UExtraContext extends
    | Partial<MergeContext<Context, MergeContext<TContext, TExtraContext>>>
    | undefined = undefined,
    UMappedInput = unknown,
  >(
    middleware: Middleware<
      MergeContext<TContext, TExtraContext>,
      UExtraContext,
      UMappedInput,
      unknown
    >,
    mapInput: MapInputMiddleware<unknown, UMappedInput>,
  ): Builder<TContext, MergeContext<TExtraContext, UExtraContext>>

  use(
    middleware: Middleware<any, any, any, any>,
    mapInput?: MapInputMiddleware<any, any>,
  ): Builder<any, any> {
    const middleware_ = mapInput
      ? decorateMiddleware(middleware).mapInput(mapInput)
      : middleware

    return new Builder({
      ...this.zz$b,
      middlewares: [...(this.zz$b.middlewares || []), middleware_],
    })
  }

  /**
   * Convert to ContractProcedureBuilder
   */

  route(
    opts: RouteOptions,
  ): ProcedureBuilder<TContext, TExtraContext, undefined, undefined> {
    return new ProcedureBuilder({
      middlewares: this.zz$b.middlewares,
      contract: new ContractProcedure({
        ...opts,
        InputSchema: undefined,
        OutputSchema: undefined,
      }),
    })
  }

  input<USchema extends Schema = undefined>(
    schema: USchema,
    example?: SchemaInput<USchema>,
  ): ProcedureBuilder<TContext, TExtraContext, USchema, undefined> {
    return new ProcedureBuilder({
      middlewares: this.zz$b.middlewares,
      contract: new ContractProcedure({
        OutputSchema: undefined,
        InputSchema: schema,
        inputExample: example,
      }),
    })
  }

  output<USchema extends Schema = undefined>(
    schema: USchema,
    example?: SchemaOutput<USchema>,
  ): ProcedureBuilder<TContext, TExtraContext, undefined, USchema> {
    return new ProcedureBuilder({
      middlewares: this.zz$b.middlewares,
      contract: new ContractProcedure({
        InputSchema: undefined,
        OutputSchema: schema,
        outputExample: example,
      }),
    })
  }

  /**
   * Convert to Procedure
   */
  func<UFuncOutput = undefined>(
    func: ProcedureFunc<
      TContext,
      TExtraContext,
      undefined,
      undefined,
      UFuncOutput
    >,
  ): DecoratedProcedure<
      TContext,
      TExtraContext,
      undefined,
      undefined,
      UFuncOutput
    > {
    return decorateProcedure({
      zz$p: {
        middlewares: this.zz$b.middlewares,
        contract: new ContractProcedure({
          InputSchema: undefined,
          OutputSchema: undefined,
        }),
        func,
      },
    })
  }

  /**
   * Convert to ProcedureImplementer | RouterBuilder
   */

  contract<UContract extends ContractProcedure<any, any> | ContractRouter>(
    contract: UContract,
  ): UContract extends ContractProcedure<
      infer UInputSchema,
      infer UOutputSchema
    >
      ? ProcedureImplementer<TContext, TExtraContext, UInputSchema, UOutputSchema>
      : UContract extends ContractRouter
        ? ChainedRouterImplementer<TContext, UContract, TExtraContext>
        : never {
    if (isContractProcedure(contract)) {
      return new ProcedureImplementer({
        contract,
        middlewares: this.zz$b.middlewares,
      }) as any
    }

    return chainRouterImplementer(
      contract as ContractRouter,
      this.zz$b.middlewares,
    ) as any
  }

  /**
   * Create ExtendedMiddleware
   */

  // TODO: TOutput always any, infer not work at all, because TOutput used inside middleware params,
  // solution (maybe): create new generic for .output() method
  middleware<UExtraContext extends Context = undefined, TInput = unknown, TOutput = any>(
    middleware: Middleware<
      MergeContext<TContext, TExtraContext>,
      UExtraContext,
      TInput,
      TOutput
    >,
  ): DecoratedMiddleware<
      MergeContext<TContext, TExtraContext>,
      UExtraContext,
      TInput,
      TOutput
    > {
    return decorateMiddleware(middleware)
  }

  prefix(prefix: HTTPPath): RouterBuilder<TContext, TExtraContext> {
    return new RouterBuilder({
      ...this.zz$b,
      prefix,
    })
  }

  tags(...tags: string[]): RouterBuilder<TContext, TExtraContext> {
    return new RouterBuilder({
      ...this.zz$b,
      tags,
    })
  }

  /**
   * Create DecoratedRouter
   */
  router<URouter extends Router<TContext>>(
    router: URouter,
  ): HandledRouter<URouter> {
    return new RouterBuilder<TContext, TExtraContext>(this.zz$b).router(router)
  }

  lazy<U extends Procedure<TContext, any, any, any, any> | Router<TContext>>(
    load: () => Promise<{ default: U }>,
  ): U extends Procedure<infer UContext, infer UExtraContext, infer UInputSchema, infer UOutputSchema, infer UFuncOutput>
      ? DecoratedLazyProcedure<UContext, UExtraContext, UInputSchema, UOutputSchema, UFuncOutput>
      : U extends Router<any>
        ? LazyRouter<U>
        : never {
    return createLazyProcedureOrLazyRouter({
      load: () => load().then(m => m.default),
      middlewares: this.zz$b.middlewares,
    })
  }
}
