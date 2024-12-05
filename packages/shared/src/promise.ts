export function isPromise(item: unknown): item is Promise<any> {
  if ((typeof item !== 'object' && typeof item !== 'function') || item === null) {
    return false
  }

  return 'then' in item && typeof item.then === 'function'
}

export async function thenThen<T>(val: T): Promise<{ value: Awaited<T> }> {
  if (!isPromise(val)) {
    return { value: val as any }
  }

  return val.then(thenThen)
}
