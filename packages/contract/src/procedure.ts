import type { HTTPMethod, HTTPPath, Schema, SchemaOutput } from './types'

export interface RouteOptions {
  method?: HTTPMethod
  path?: HTTPPath
  summary?: string
  description?: string
  deprecated?: boolean
  tags?: string[]
}

export class ContractProcedure<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
> {
  constructor(
    public zz$cp: {
      path?: HTTPPath
      method?: HTTPMethod
      summary?: string
      description?: string
      deprecated?: boolean
      tags?: string[]
      InputSchema: TInputSchema
      inputExample?: SchemaOutput<TInputSchema>
      inputExamples?: Record<string, SchemaOutput<TInputSchema>>
      OutputSchema: TOutputSchema
      outputExample?: SchemaOutput<TOutputSchema>
      outputExamples?: Record<string, SchemaOutput<TOutputSchema>>
    },
  ) {}
}

export class DecoratedContractProcedure<
  TInputSchema extends Schema,
  TOutputSchema extends Schema,
> extends ContractProcedure<TInputSchema, TOutputSchema> {
  static decorate<TInputSchema extends Schema, TOutputSchema extends Schema>(
    cp: ContractProcedure<TInputSchema, TOutputSchema>,
  ): DecoratedContractProcedure<TInputSchema, TOutputSchema> {
    if (cp instanceof DecoratedContractProcedure) return cp
    return new DecoratedContractProcedure(cp.zz$cp)
  }

  route(
    opts: RouteOptions,
  ): DecoratedContractProcedure<TInputSchema, TOutputSchema> {
    return new DecoratedContractProcedure({
      ...this.zz$cp,
      ...opts,
      method: opts.method,
      path: opts.path,
    })
  }

  prefix(
    prefix: HTTPPath,
  ): DecoratedContractProcedure<TInputSchema, TOutputSchema> {
    if (!this.zz$cp.path) return this

    return new DecoratedContractProcedure({
      ...this.zz$cp,
      path: `${prefix}${this.zz$cp.path}`,
    })
  }

  addTags(
    ...tags: string[]
  ): DecoratedContractProcedure<TInputSchema, TOutputSchema> {
    if (!tags.length) return this

    return new DecoratedContractProcedure({
      ...this.zz$cp,
      tags: [...(this.zz$cp.tags ?? []), ...tags],
    })
  }

  input<USchema extends Schema>(
    schema: USchema,
    example?: SchemaOutput<USchema>,
    examples?: Record<string, SchemaOutput<USchema>>,
  ): DecoratedContractProcedure<USchema, TOutputSchema> {
    return new DecoratedContractProcedure({
      ...this.zz$cp,
      InputSchema: schema,
      inputExample: example,
      inputExamples: examples,
    })
  }

  output<USchema extends Schema>(
    schema: USchema,
    example?: SchemaOutput<USchema>,
    examples?: Record<string, SchemaOutput<USchema>>,
  ): DecoratedContractProcedure<TInputSchema, USchema> {
    return new DecoratedContractProcedure({
      ...this.zz$cp,
      OutputSchema: schema,
      outputExample: example,
      outputExamples: examples,
    })
  }
}

export type WELL_DEFINED_CONTRACT_PROCEDURE = ContractProcedure<Schema, Schema>

export function isContractProcedure(
  item: unknown,
): item is WELL_DEFINED_CONTRACT_PROCEDURE {
  if (item instanceof ContractProcedure) return true

  try {
    const anyItem = item as WELL_DEFINED_CONTRACT_PROCEDURE
    return (
      typeof anyItem.zz$cp === 'object' &&
      anyItem.zz$cp !== null &&
      'InputSchema' in anyItem.zz$cp &&
      'OutputSchema' in anyItem.zz$cp
    )
  } catch {
    return false
  }
}
