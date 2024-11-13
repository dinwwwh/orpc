import {
  getCustomJSONSchema,
  getCustomZodFileMimeType,
  getCustomZodType,
} from '@orpc/zod'
import escapeStringRegexp from 'escape-string-regexp'
import {
  Format,
  type JSONSchema,
  type keywords,
} from 'json-schema-typed/draft-2020-12'
import {
  type EnumLike,
  type KeySchema,
  type ZodAny,
  type ZodArray,
  type ZodBigInt,
  type ZodBoolean,
  type ZodBranded,
  type ZodCatch,
  type ZodDate,
  type ZodDefault,
  type ZodDiscriminatedUnion,
  type ZodEffects,
  type ZodEnum,
  ZodFirstPartyTypeKind,
  type ZodIntersection,
  type ZodLazy,
  type ZodLiteral,
  type ZodMap,
  type ZodNaN,
  type ZodNativeEnum,
  type ZodNullable,
  type ZodNumber,
  type ZodObject,
  type ZodOptional,
  type ZodPipeline,
  type ZodRawShape,
  type ZodReadonly,
  type ZodRecord,
  type ZodSet,
  type ZodString,
  type ZodTuple,
  type ZodTypeAny,
  type ZodUnion,
  type ZodUnionOptions,
} from 'zod'

export const NON_LOGIC_KEYWORDS = [
  // Core Documentation Keywords
  '$anchor',
  '$comment',
  '$defs',
  '$id',
  'title',
  'description',

  // Value Keywords
  'default',
  'deprecated',
  'examples',

  // Metadata Keywords
  '$schema',
  'definitions', // Legacy, but still used
  'readOnly',
  'writeOnly',

  // Display and UI Hints
  'contentMediaType',
  'contentEncoding',
  'format',

  // Custom Extensions
  '$vocabulary',
  '$dynamicAnchor',
  '$dynamicRef',
] satisfies (typeof keywords)[number][]

export const UNSUPPORTED_JSON_SCHEMA = { not: {} }
export const UNDEFINED_JSON_SCHEMA = { const: 'undefined' }

export interface ZodToJsonSchemaOptions {
  /**
   * Max depth of lazy type, if it exceeds.
   *
   * Used `{}` when reach max depth
   *
   * @default 5
   */
  maxLazyDepth?: number

  /**
   * The length used to track the depth of lazy type
   *
   * @internal
   */
  lazyDepth?: number

  /**
   * The expected json schema for input or output zod schema
   *
   * @default input
   */
  mode?: 'input' | 'output'

  /**
   * Track if current level schema is handled custom json schema to prevent recursive
   *
   * @internal
   */
  isHandledCustomJSONSchema?: boolean

  /**
   *
   *
   */
  reusableSchemas?: {
    zodSchema: ZodTypeAny
    isOnlyOutput: boolean
    jsonSchema: Exclude<JSONSchema, boolean>
  }[]
}

export function zodToJsonSchema(
  schema: ZodTypeAny,
  options?: ZodToJsonSchemaOptions,
): Exclude<JSONSchema, boolean> {
  const mode = options?.mode ?? 'input'
  const matchReusableSchema = options?.reusableSchemas?.find(
    ({ zodSchema }) => schema === zodSchema,
  )
  if (
    matchReusableSchema &&
    (!matchReusableSchema.isOnlyOutput || mode === 'output')
  ) {
    return matchReusableSchema.jsonSchema
  }

  if (!options?.isHandledCustomJSONSchema) {
    const customJSONSchema = getCustomJSONSchema(schema._def, options)

    if (customJSONSchema) {
      const json = zodToJsonSchema(schema, {
        ...options,
        isHandledCustomJSONSchema: true,
      })

      return {
        ...json,
        ...customJSONSchema,
      }
    }
  }

  const childOptions = { ...options, isHandledCustomJSONSchema: false }

  const customType = getCustomZodType(schema._def)

  switch (customType) {
    case 'Blob': {
      return { type: 'string', contentMediaType: '*/*' }
    }

    case 'File': {
      const mimeType = getCustomZodFileMimeType(schema._def) ?? '*/*'

      return { type: 'string', contentMediaType: mimeType }
    }

    case 'Invalid Date': {
      return { const: 'Invalid Date' }
    }

    case 'RegExp': {
      return {
        type: 'string',
        pattern: '^\\/(.*)\\/([a-z]*)$',
      }
    }

    case 'URL': {
      return { type: 'string', format: Format.URI }
    }
  }

  const _expectedCustomType: undefined = customType

  const typeName = schema._def.typeName as ZodFirstPartyTypeKind | undefined

  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodString: {
      const schema_ = schema as ZodString

      const json: JSONSchema = { type: 'string' }

      for (const check of schema_._def.checks) {
        switch (check.kind) {
          case 'base64':
            json.contentEncoding = 'base64'
            break
          case 'cuid':
            json.pattern = '^[0-9A-HJKMNP-TV-Z]{26}$'
            break
          case 'email':
            json.format = Format.Email
            break
          case 'url':
            json.format = Format.URI
            break
          case 'uuid':
            json.format = Format.UUID
            break
          case 'regex':
            json.pattern = check.regex.source
            break
          case 'min':
            json.minLength = check.value
            break
          case 'max':
            json.maxLength = check.value
            break
          case 'length':
            json.minLength = check.value
            json.maxLength = check.value
            break
          case 'includes':
            json.pattern = escapeStringRegexp(check.value)
            break
          case 'startsWith':
            json.pattern = `^${escapeStringRegexp(check.value)}`
            break
          case 'endsWith':
            json.pattern = `${escapeStringRegexp(check.value)}$`
            break
          case 'emoji':
            json.pattern =
              '^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$'
            break
          case 'nanoid':
            json.pattern = '^[a-zA-Z0-9_-]{21}$'
            break
          case 'cuid2':
            json.pattern = '^[0-9a-z]+$'
            break
          case 'ulid':
            json.pattern = '^[0-9A-HJKMNP-TV-Z]{26}$'
            break
          case 'datetime':
            json.format = Format.DateTime
            break
          case 'date':
            json.format = Format.Date
            break
          case 'time':
            json.format = Format.Time
            break
          case 'duration':
            json.format = Format.Duration
            break
          case 'ip':
            json.format = Format.IPv4
            break
          default: {
            const _expect: 'toLowerCase' | 'toUpperCase' | 'trim' = check.kind
          }
        }
      }

      return json
    }

    case ZodFirstPartyTypeKind.ZodNumber: {
      const schema_ = schema as ZodNumber

      const json: JSONSchema = { type: 'number' }

      for (const check of schema_._def.checks) {
        switch (check.kind) {
          case 'int':
            json.type = 'integer'
            break
          case 'min':
            json.minimum = check.value
            break
          case 'max':
            json.maximum = check.value
            break
          case 'multipleOf':
            json.multipleOf = check.value
            break
          default: {
            const _expect: 'finite' = check.kind
          }
        }
      }

      return json
    }

    case ZodFirstPartyTypeKind.ZodNaN: {
      const schema_ = schema as ZodNaN

      return { const: 'NaN' }
    }

    case ZodFirstPartyTypeKind.ZodBigInt: {
      const schema_ = schema as ZodBigInt

      const json: JSONSchema = { type: 'string', pattern: '^-?[0-9]+$' }

      // WARN: ignore checks

      return json
    }

    case ZodFirstPartyTypeKind.ZodBoolean: {
      const schema_ = schema as ZodBoolean

      return { type: 'boolean' }
    }

    case ZodFirstPartyTypeKind.ZodDate: {
      const schema_ = schema as ZodDate

      const jsonSchema: JSONSchema = { type: 'string', format: Format.Date }

      // WARN: ignore checks

      return jsonSchema
    }

    case ZodFirstPartyTypeKind.ZodNull: {
      return { type: 'null' }
    }

    case ZodFirstPartyTypeKind.ZodVoid:
    case ZodFirstPartyTypeKind.ZodUndefined: {
      return UNDEFINED_JSON_SCHEMA
    }

    case ZodFirstPartyTypeKind.ZodLiteral: {
      const schema_ = schema as ZodLiteral<unknown>
      return { const: schema_._def.value }
    }

    case ZodFirstPartyTypeKind.ZodEnum: {
      const schema_ = schema as ZodEnum<[string, ...string[]]>

      return {
        enum: schema_._def.values,
      }
    }

    case ZodFirstPartyTypeKind.ZodNativeEnum: {
      const schema_ = schema as ZodNativeEnum<EnumLike>

      return {
        enum: Object.values(schema_._def.values),
      }
    }

    case ZodFirstPartyTypeKind.ZodArray: {
      const schema_ = schema as ZodArray<ZodTypeAny>
      const def = schema_._def

      const json: JSONSchema = { type: 'array' }

      if (def.exactLength) {
        json.maxItems = def.exactLength.value
        json.minItems = def.exactLength.value
      }

      if (def.minLength) {
        json.minItems = def.minLength.value
      }

      if (def.maxLength) {
        json.maxItems = def.maxLength.value
      }

      return json
    }

    case ZodFirstPartyTypeKind.ZodTuple: {
      const schema_ = schema as ZodTuple<
        [ZodTypeAny, ...ZodTypeAny[]],
        ZodTypeAny | null
      >

      const prefixItems: JSONSchema[] = []
      const json: JSONSchema = { type: 'array' }

      for (const item of schema_._def.items) {
        prefixItems.push(zodToJsonSchema(item, childOptions))
      }

      if (prefixItems?.length) {
        json.prefixItems = prefixItems
      }

      if (schema_._def.rest) {
        const items = zodToJsonSchema(schema_._def.rest, childOptions)
        if (items) {
          json.items = items
        }
      }

      return json
    }

    case ZodFirstPartyTypeKind.ZodObject: {
      const schema_ = schema as ZodObject<ZodRawShape>

      const json: JSONSchema = { type: 'object' }
      const properties: Record<string, JSONSchema> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(schema_.shape)) {
        const { schema, matches } = extractJSONSchema(
          zodToJsonSchema(value, childOptions),
          (schema) => schema === UNDEFINED_JSON_SCHEMA,
        )

        if (schema) {
          properties[key] = schema
        }

        if (matches.length === 0) {
          required.push(key)
        }
      }

      if (Object.keys(properties).length) {
        json.properties = properties
      }

      if (required.length) {
        json.required = required
      }

      const additionalProperties = zodToJsonSchema(
        schema_._def.catchall,
        childOptions,
      )
      if (schema_._def.unknownKeys === 'strict') {
        json.additionalProperties =
          additionalProperties === UNSUPPORTED_JSON_SCHEMA
            ? false
            : additionalProperties
      } else {
        if (
          additionalProperties &&
          additionalProperties !== UNSUPPORTED_JSON_SCHEMA
        ) {
          json.additionalProperties = additionalProperties
        }
      }

      return json
    }

    case ZodFirstPartyTypeKind.ZodRecord: {
      const schema_ = schema as ZodRecord<KeySchema, ZodAny>

      const json: JSONSchema = { type: 'object' }

      json.additionalProperties = zodToJsonSchema(
        schema_._def.valueType,
        childOptions,
      )

      return json
    }

    case ZodFirstPartyTypeKind.ZodSet: {
      const schema_ = schema as ZodSet

      return {
        type: 'array',
        items: zodToJsonSchema(schema_._def.valueType, childOptions),
      }
    }

    case ZodFirstPartyTypeKind.ZodMap: {
      const schema_ = schema as ZodMap

      return {
        type: 'array',
        items: {
          type: 'array',
          prefixItems: [
            zodToJsonSchema(schema_._def.keyType, childOptions),
            zodToJsonSchema(schema_._def.valueType, childOptions),
          ],
          maxItems: 2,
          minItems: 2,
        },
      }
    }

    case ZodFirstPartyTypeKind.ZodUnion:
    case ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      const schema_ = schema as
        | ZodUnion<ZodUnionOptions>
        | ZodDiscriminatedUnion<string, [ZodObject<any>, ...ZodObject<any>[]]>

      const anyOf: JSONSchema[] = []

      for (const s of schema_._def.options) {
        anyOf.push(zodToJsonSchema(s, childOptions))
      }

      return { anyOf }
    }

    case ZodFirstPartyTypeKind.ZodIntersection: {
      const schema_ = schema as ZodIntersection<ZodTypeAny, ZodTypeAny>

      const allOf: JSONSchema[] = []

      for (const s of [schema_._def.left, schema_._def.right]) {
        allOf.push(zodToJsonSchema(s, childOptions))
      }

      return { allOf }
    }

    case ZodFirstPartyTypeKind.ZodLazy: {
      const schema_ = schema as ZodLazy<ZodTypeAny>

      const maxLazyDepth = childOptions?.maxLazyDepth ?? 5
      const lazyDepth = childOptions?.lazyDepth ?? 0

      if (lazyDepth > maxLazyDepth) {
        return {}
      }

      return zodToJsonSchema(schema_._def.getter(), {
        ...childOptions,
        lazyDepth: lazyDepth + 1,
      })
    }

    case ZodFirstPartyTypeKind.ZodUnknown:
    case ZodFirstPartyTypeKind.ZodAny:
    case undefined: {
      return {}
    }

    case ZodFirstPartyTypeKind.ZodOptional: {
      const schema_ = schema as ZodOptional<ZodTypeAny>

      const inner = zodToJsonSchema(schema_._def.innerType, childOptions)

      return {
        anyOf: [UNDEFINED_JSON_SCHEMA, inner],
      }
    }

    case ZodFirstPartyTypeKind.ZodReadonly: {
      const schema_ = schema as ZodReadonly<ZodTypeAny>
      return zodToJsonSchema(schema_._def.innerType, childOptions)
    }

    case ZodFirstPartyTypeKind.ZodDefault: {
      const schema_ = schema as ZodDefault<ZodTypeAny>
      return zodToJsonSchema(schema_._def.innerType, childOptions)
    }

    case ZodFirstPartyTypeKind.ZodEffects: {
      const schema_ = schema as ZodEffects<ZodTypeAny>

      if (schema_._def.effect.type === 'transform' && mode === 'output') {
        return {}
      }

      return zodToJsonSchema(schema_._def.schema, childOptions)
    }

    case ZodFirstPartyTypeKind.ZodCatch: {
      const schema_ = schema as ZodCatch<ZodTypeAny>
      return zodToJsonSchema(schema_._def.innerType, childOptions)
    }

    case ZodFirstPartyTypeKind.ZodBranded: {
      const schema_ = schema as ZodBranded<ZodTypeAny, string | number | symbol>
      return zodToJsonSchema(schema_._def.type, childOptions)
    }

    case ZodFirstPartyTypeKind.ZodPipeline: {
      const schema_ = schema as ZodPipeline<ZodTypeAny, ZodTypeAny>
      return zodToJsonSchema(
        mode === 'output' ? schema_._def.out : schema_._def.in,
        childOptions,
      )
    }

    case ZodFirstPartyTypeKind.ZodNullable: {
      const schema_ = schema as ZodNullable<ZodTypeAny>

      const inner = zodToJsonSchema(schema_._def.innerType, childOptions)

      return {
        anyOf: [{ type: 'null' }, inner],
      }
    }
  }

  const _expected:
    | ZodFirstPartyTypeKind.ZodPromise
    | ZodFirstPartyTypeKind.ZodSymbol
    | ZodFirstPartyTypeKind.ZodFunction
    | ZodFirstPartyTypeKind.ZodNever = typeName

  return UNSUPPORTED_JSON_SCHEMA
}

export function extractJSONSchema(
  schema: JSONSchema,
  check: (schema: JSONSchema) => boolean,
  matches: JSONSchema[] = [],
): { schema: JSONSchema | undefined; matches: JSONSchema[] } {
  if (check(schema)) {
    matches.push(schema)
    return { schema: undefined, matches }
  }

  if (typeof schema === 'boolean') {
    return { schema, matches }
  }

  if (
    schema.anyOf &&
    Object.keys(schema).every(
      (k) => k === 'anyOf' || NON_LOGIC_KEYWORDS.includes(k as any),
    )
  ) {
    const anyOf = schema.anyOf
      .map((s) => extractJSONSchema(s, check, matches).schema)
      .filter((v) => !!v)

    if (anyOf.length === schema.anyOf.length) {
      return { schema, matches }
    }

    if (anyOf.length === 1 && typeof anyOf[0] === 'object') {
      return { schema: { ...schema, anyOf: undefined, ...anyOf[0] }, matches }
    }

    return {
      schema: {
        ...schema,
        anyOf,
      },
      matches,
    }
  }

  if (
    schema.oneOf &&
    Object.keys(schema).every(
      (k) => k === 'oneOf' || NON_LOGIC_KEYWORDS.includes(k as any),
    )
  ) {
    const oneOf = schema.oneOf
      .map((s) => extractJSONSchema(s, check, matches).schema)
      .filter((v) => !!v)

    if (oneOf.length === schema.oneOf.length) {
      return { schema, matches }
    }

    if (oneOf.length === 1 && typeof oneOf[0] === 'object') {
      return { schema: { ...schema, oneOf: undefined, ...oneOf[0] }, matches }
    }

    return {
      schema: {
        ...schema,
        oneOf,
      },
      matches,
    }
  }

  return { schema, matches }
}
