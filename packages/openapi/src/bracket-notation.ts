import type { Segment } from '@orpc/shared'
import { getOwn, isPlainObject, NullProtoObj, setOwn } from '@orpc/shared'

export type BracketNotationSerializeResult = [string, unknown][]

export interface BracketNotationSerializerOptions {
  /**
   * Maximum explicit array index allowed during deserialization (e.g., `arr[0]`, `arr[999]`).
   * If the index exceeds this limit, the array is deserialized as an object instead.
   *
   * This guards against memory exhaustion attacks where malicious input uses extremely large
   * indices (e.g., `?arr[4294967296]=value`). Although orpc uses sparse arrays handle large indices
   * efficiently, downstream code may inadvertently densify them - creating millions of
   * undefined slots and exhausting memory.
   *
   * NOTE: Does not apply to append-style notation (e.g., `arr[]`).
   *
   * @default 999 (array with 1,000 elements)
   */
  maxExplicitDeserializingArrayIndex?: number
}

export class BracketNotationSerializer {
  private readonly maxExplicitDeserializingArrayIndex: number

  constructor(options: BracketNotationSerializerOptions = {}) {
    this.maxExplicitDeserializingArrayIndex = options.maxExplicitDeserializingArrayIndex ?? 999
  }

  serialize(data: unknown): BracketNotationSerializeResult {
    const result: BracketNotationSerializeResult = []
    this.internalSerialize(data, '', true, result)
    return result
  }

  private internalSerialize(data: unknown, path: string, isRoot: boolean, result: BracketNotationSerializeResult): void {
    if (Array.isArray(data)) {
      data.forEach((item, i) => {
        this.internalSerialize(item, isRoot ? i.toString() : `${path}[${i}]`, false, result)
      })
    }

    else if (isPlainObject(data)) {
      for (const key in data) {
        this.internalSerialize(data[key], isRoot ? key : `${path}[${key}]`, false, result)
      }
    }

    else {
      result.push([path, data])
    }
  }

  deserialize(serialized: BracketNotationSerializeResult): Record<string, unknown> {
    if (serialized.length === 0) {
      return new NullProtoObj() // Prevent Prototype Pollution with NullProtoObj
    }

    const arrayPushStyles = new WeakSet()
    const ref: { value: Record<string, unknown> } = { value: new NullProtoObj() } // Prevent Prototype Pollution with NullProtoObj

    for (const [path, value] of serialized) {
      const segments = this.parsePath(path)

      let currentRef: any = ref
      let nextSegment: string = 'value'

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]!

        // Read/write own properties only, so a `__proto__` segment cannot walk into a prototype
        let child: any = getOwn(currentRef, nextSegment)

        if (!Array.isArray(child) && !isPlainObject(child)) {
          child = []
        }

        if (i !== segments.length - 1) {
          if (Array.isArray(child) && !internalIsValidArrayIndex(segment, this.maxExplicitDeserializingArrayIndex)) {
            if (arrayPushStyles.delete(child)) {
              child = internalPushStyleArrayToObject(child)
            }
            else {
              child = internalArrayToObject(child)
            }
          }
        }
        else {
          if (Array.isArray(child)) {
            if (segment === '') {
              if (child.length && !arrayPushStyles.has(child)) {
                child = internalArrayToObject(child)
              }
            }
            else {
              if (arrayPushStyles.delete(child)) {
                child = internalPushStyleArrayToObject(child)
              }

              else if (!internalIsValidArrayIndex(segment, this.maxExplicitDeserializingArrayIndex)) {
                child = internalArrayToObject(child)
              }
            }
          }
        }

        setOwn(currentRef, nextSegment, child)

        currentRef = child
        nextSegment = segment
      }

      if (Array.isArray(currentRef) && nextSegment === '') {
        arrayPushStyles.add(currentRef)
        currentRef.push(value)
      }
      else if (Object.hasOwn(currentRef, nextSegment)) {
        const current = getOwn(currentRef, nextSegment)

        if (Array.isArray(current)) {
          current.push(value)
        }
        else {
          setOwn(currentRef, nextSegment, [current, value])
        }
      }
      else {
        setOwn(currentRef, nextSegment, value)
      }
    }

    return ref.value
  }

  stringifyPath(segments: readonly Segment[]): string {
    if (segments.length === 0) {
      return ''
    }

    let result = segments[0]!.toString()

    for (let i = 1; i < segments.length; i++) {
      result += `[${segments[i]}]`
    }

    return result
  }

  parsePath(path: string): string[] {
    const segments: string[] = []

    let inBrackets = false
    let currentSegment = ''

    for (let i = 0; i < path.length; i++) {
      const char = path[i]!
      const nextChar = path[i + 1]

      if (inBrackets && char === ']' && (nextChar === undefined || nextChar === '[')) {
        if (nextChar === undefined) {
          inBrackets = false
        }

        segments.push(currentSegment)
        currentSegment = ''
        i++
      }

      else if (segments.length === 0 && char === '[') {
        inBrackets = true
        segments.push(currentSegment)
        currentSegment = ''
      }

      else {
        currentSegment += char
      }
    }

    return inBrackets || segments.length === 0 ? [path] : segments
  }
}

const INTEGER_PATTERN = /^0$|^[1-9]\d*$/
function internalIsValidArrayIndex(value: string, maxIndex: number): boolean {
  return INTEGER_PATTERN.test(value) && Number(value) <= maxIndex
}

function internalArrayToObject(array: readonly unknown[]): Record<string, unknown> {
  const obj = new NullProtoObj() // Prevent Prototype Pollution with NullProtoObj

  array.forEach((item, i) => {
    obj[i] = item
  })

  return obj
}

function internalPushStyleArrayToObject(array: readonly unknown[]): Record<string, unknown> {
  const obj = new NullProtoObj()

  obj[''] = array.length === 1 ? array[0] : array

  return obj
}
