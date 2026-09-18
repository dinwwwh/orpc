export interface OrderablePlugin {
  /** Unique name of the plugin, used for ordering and identification. */
  name: string

  /** Plugins this plugin should execute before. */
  before?: string[] | undefined

  /** Plugins this plugin should execute after. */
  after?: string[] | undefined
}

/**
 * Sorts plugins based on their `before` and `after` dependencies.
 *
 * The sort is stable: plugins keep their registration order unless a
 * `before` or `after` constraint forces them to move.
 */
export function sortPlugins<T extends OrderablePlugin>(
  plugins: T[],
): T[] {
  const pluginCount = plugins.length

  const pluginIdToIndices = new Map<string, number[]>()

  for (let i = 0; i < pluginCount; i++) {
    const plugin = plugins[i]!

    const indices = pluginIdToIndices.get(plugin.name)
    if (indices === undefined) {
      pluginIdToIndices.set(plugin.name, [i])
    }
    else {
      indices.push(i)
    }
  }

  const dependencies: Array<Set<number>> = Array.from(
    { length: pluginCount },
    () => new Set<number>(),
  )

  for (let i = 0; i < pluginCount; i++) {
    const plugin = plugins[i]!

    const beforeList = plugin.before
    if (beforeList !== undefined) {
      for (const beforeId of beforeList) {
        const beforeIndices = pluginIdToIndices.get(beforeId)
        if (beforeIndices === undefined)
          continue

        for (const beforeIndex of beforeIndices) {
          dependencies[beforeIndex]!.add(i)
        }
      }
    }

    const afterList = plugin.after
    if (afterList !== undefined) {
      for (const afterId of afterList) {
        const afterIndices = pluginIdToIndices.get(afterId)
        if (afterIndices === undefined)
          continue

        for (const afterIndex of afterIndices) {
          dependencies[i]!.add(afterIndex)
        }
      }
    }
  }

  const sorted: T[] = []
  const placed: boolean[] = Array.from({ length: pluginCount }).fill(false) as boolean[]

  while (sorted.length < pluginCount) {
    let next = -1

    for (let i = 0; i < pluginCount; i++) {
      if (placed[i])
        continue

      let ready = true
      for (const dependency of dependencies[i]!) {
        if (!placed[dependency]) {
          ready = false
          break
        }
      }

      if (ready) {
        next = i
        break
      }
    }

    if (next === -1) {
      throw new Error(`Circular dependency detected involving plugin "${findCyclicPlugin(plugins, dependencies, placed).name}"`)
    }

    placed[next] = true
    sorted.push(plugins[next]!)
  }

  return sorted
}

/**
 * Every unplaced plugin either sits on a cycle or depends on one, so walking
 * unplaced dependencies from any of them eventually revisits a cycle member.
 */
function findCyclicPlugin<T extends OrderablePlugin>(
  plugins: T[],
  dependencies: Array<Set<number>>,
  placed: boolean[],
): T {
  const seen = new Set<number>()
  let current = placed.indexOf(false)

  while (!seen.has(current)) {
    seen.add(current)

    for (const dependency of dependencies[current]!) {
      if (!placed[dependency]) {
        current = dependency
        break
      }
    }
  }

  return plugins[current]!
}
