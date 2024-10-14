export function get(obj: any, path: string[]): unknown {
  try {
    let obj_ = obj
    for (const key of path) {
      obj_ = obj_[key]
    }
    return obj_
  } catch {
    return undefined
  }
}
