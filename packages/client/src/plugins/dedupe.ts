import type { AsyncIteratorClass, InterceptorOptions, Value } from '@orpc/shared'
import type { StandardBody, StandardLazyResponse, StandardRequest } from '@standard-server/core'
import type { StandardLinkOptions, StandardLinkPlugin, StandardLinkTransportInterceptor, StandardLinkTransportInterceptorOptions } from '../adapters/standard'
import type { ClientContext } from '../types'
import { allAbortSignal, defer, isAsyncIteratorObject, replicateAsyncIterator, replicateReadableStream, runWithSignal, stringifyJSON, throwIfAborted, toArray, value, wrapAsyncIterator } from '@orpc/shared'

export interface DedupeLinkPluginGroup<T extends ClientContext> {
  condition: Value<boolean, [options: StandardLinkTransportInterceptorOptions<T>]>
  /**
   * The context used for the rest of the request lifecycle.
   */
  context: Value<T, [items: [
    StandardLinkTransportInterceptorOptions<T>,
    StandardLinkTransportInterceptorOptions<T>,
    ...StandardLinkTransportInterceptorOptions<T>[],
  ]]>
}

export interface DedupeLinkPluginOptions<T extends ClientContext> {
  /**
   * To enable deduplication, a request must match at least one defined group.
   * Requests that fall into the same group are considered for deduplication together.
   */
  groups: [DedupeLinkPluginGroup<T>, ...DedupeLinkPluginGroup<T>[]]

  /**
   * Filters requests to dedupe.
   *
   * @default ({ request }) => request.method === 'GET' || request.method === 'QUERY'
   */
  filter?: Value<boolean, [options: StandardLinkTransportInterceptorOptions<T>]>

  /**
   * How long (in ms) to wait for more identical requests before sending,
   * counted from the first queued request.
   * With `0`, only requests made in the same event loop tick are deduplicated.
   *
   * @default 0
   */
  wait?: number
}

/**
 * Prevents redundant requests by deduplicating similar in-flight requests,
 * reducing the number of requests sent to the server.
 *
 * @see {@link https://orpc.dev/docs/plugins/dedupe | Dedupe Plugin}
 */
export class DedupeLinkPlugin<T extends ClientContext> implements StandardLinkPlugin<T> {
  name = '~dedupe'
  before = ['~batch']

  private readonly groups: DedupeLinkPluginOptions<T>['groups']
  private readonly filter: Exclude<DedupeLinkPluginOptions<T>['filter'], undefined>
  private readonly wait: Exclude<DedupeLinkPluginOptions<T>['wait'], undefined>

  private readonly queue: Map<DedupeLinkPluginGroup<T>, Map<string, DedupeCaller<T>[]>> = new Map()

  constructor(options: NoInfer<DedupeLinkPluginOptions<T>>) {
    this.groups = options.groups
    this.filter = options.filter ?? (({ request }) => request.method === 'GET' || request.method === 'QUERY')
    this.wait = options.wait ?? 0
  }

  init(options: StandardLinkOptions<T>): StandardLinkOptions<T> {
    const transportInterceptor: StandardLinkTransportInterceptor<T> = (interceptorOptions) => {
      if (!canDedupeRequest(interceptorOptions.request) || !value(this.filter, interceptorOptions)) {
        return interceptorOptions.next()
      }

      const group = this.groups.find(group => value(group.condition, interceptorOptions))

      if (!group) {
        return interceptorOptions.next()
      }

      return runWithSignal(interceptorOptions.request.signal, () => new Promise((resolve, reject) => {
        // Schedule only for the first queued request, so later ones cannot extend or split the wait.
        if (!this.queue.size) {
          defer(() => this.processPendingRequests(), this.wait)
        }

        this.enqueue(group, { options: interceptorOptions, resolve, reject })
      }))
    }

    return {
      ...options,
      transportInterceptors: [...toArray(options.transportInterceptors), transportInterceptor],
    }
  }

  private enqueue(group: DedupeLinkPluginGroup<T>, caller: DedupeCaller<T>): void {
    let queue = this.queue.get(group)

    if (!queue) {
      queue = new Map()
      this.queue.set(group, queue)
    }

    const requestKey = createRequestKey(caller.options.path, caller.options.request)
    const matched = queue.get(requestKey)

    if (matched) {
      matched.push(caller)
      return
    }

    queue.set(requestKey, [caller])
  }

  private async processPendingRequests(): Promise<void> {
    const pending = new Map(this.queue)
    this.queue.clear()

    const executions: Promise<void>[] = []

    for (const [group, items] of pending) {
      for (const callers of items.values()) {
        executions.push(this.execute(group, callers))
      }
    }

    await Promise.all(executions)
  }

  private async execute(
    group: DedupeLinkPluginGroup<T>,
    callers: DedupeCaller<T>[],
  ): Promise<void> {
    const activeCallers = callers.filter(caller => !caller.options.request.signal?.aborted)
    const [first] = activeCallers

    if (!first) {
      return
    }

    const matchedOptions = activeCallers.map(caller => caller.options)

    try {
      if (!shouldDedupe(matchedOptions)) {
        const response = await first.options.next(first.options)
        first.resolve(response)
        return
      }

      const context = value(group.context, matchedOptions) as T
      const signals = matchedOptions.map(options => options.request.signal)

      const request: StandardRequest = {
        ...first.options.request,
        signal: allAbortSignal(signals),
      }

      const response = await first.options.next({
        ...first.options,
        request,
        signal: request.signal,
        context,
      })

      const replicatedResponses = replicateLazyResponse(response, signals)

      activeCallers.forEach((caller, index) => caller.resolve(replicatedResponses[index]!))
    }
    catch (error) {
      for (const caller of activeCallers) {
        caller.reject(error)
      }
    }
  }
}

type DedupeCaller<T extends ClientContext> = {
  options: InterceptorOptions<StandardLinkTransportInterceptorOptions<T>, Promise<StandardLazyResponse>>
  resolve: (response: StandardLazyResponse) => void
  reject: (error: unknown) => void
}

function canDedupeRequest(request: StandardRequest): boolean {
  return !(
    request.body instanceof Blob
    || request.body instanceof FormData
    || request.body instanceof URLSearchParams
    || request.body instanceof ReadableStream
    || isAsyncIteratorObject(request.body)
    || request.signal?.aborted
  )
}

function createRequestKey(path: string[], request: StandardRequest): string {
  return stringifyJSON({
    path,
    body: request.body,
    headers: request.headers,
    method: request.method,
    url: request.url,
  } satisfies Omit<StandardRequest, 'signal'> & { path: string[] })
}

/**
 * Replicates the response once per signal. Like an unshared response, each replica's body
 * fails and stops streaming once its own signal aborts, without affecting the other replicas.
 */
function replicateLazyResponse(response: StandardLazyResponse, signals: (AbortSignal | undefined)[]): StandardLazyResponse[] {
  let bodiesPromise: Promise<StandardBody[]> | undefined

  return signals.map((signal, i) => ({
    ...response,
    resolveBody: hint => runWithSignal(signal, async () => {
      bodiesPromise ??= response.resolveBody(hint).then((body) => {
        if (isAsyncIteratorObject(body)) {
          return replicateAsyncIterator(body, signals.length)
            .map((replica, index) => closeAsyncIteratorOnAbort(replica, signals[index]))
        }

        if (body instanceof ReadableStream) {
          return replicateReadableStream(body, signals.length)
            .map((replica, index) => closeReadableStreamOnAbort(replica, signals[index]))
        }

        return signals.map(() => body)
      })

      return (await bodiesPromise)[i]
    }),
  }))
}

function closeAsyncIteratorOnAbort<T, TReturn, TNext>(
  replica: AsyncIteratorClass<T, TReturn, TNext>,
  signal: AbortSignal | undefined,
): AsyncIteratorClass<T, TReturn, TNext> {
  if (!signal) {
    return replica
  }

  const abort = () => replica.return().catch(() => {})

  if (signal.aborted) {
    void abort()
  }
  else {
    signal.addEventListener('abort', abort, { once: true })
  }

  return wrapAsyncIterator(replica, {
    mapResult(result) {
      // Ending the replica reports its reads as done rather than failed.
      throwIfAborted(signal)
      return result
    },
    onFinish: () => signal.removeEventListener('abort', abort),
  })
}

/**
 * Cancels the replica on abort even when nothing is reading it, which an aborted
 * `pipeThrough` would not do until the in-flight chunk is read.
 */
function closeReadableStreamOnAbort<T>(replica: ReadableStream<T>, signal: AbortSignal | undefined): ReadableStream<T> {
  if (!signal) {
    return replica
  }

  const reader = replica.getReader()
  const abort = () => reader.cancel(signal.reason).catch(() => {})

  if (signal.aborted) {
    void abort()
  }
  else {
    signal.addEventListener('abort', abort, { once: true })
  }

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const result = await reader.read()
        // Cancelling the replica reports its reads as done rather than failed.
        throwIfAborted(signal)

        if (result.done) {
          signal.removeEventListener('abort', abort)
          controller.close()
        }
        else {
          controller.enqueue(result.value)
        }
      }
      catch (error) {
        signal.removeEventListener('abort', abort)
        throw error
      }
    },
    async cancel(reason) {
      signal.removeEventListener('abort', abort)
      await reader.cancel(reason)
    },
  }, { highWaterMark: 0 })
}

function shouldDedupe<T extends ClientContext>(
  items: StandardLinkTransportInterceptorOptions<T>[],
): items is [
  StandardLinkTransportInterceptorOptions<T>,
  StandardLinkTransportInterceptorOptions<T>,
  ...StandardLinkTransportInterceptorOptions<T>[],
] {
  return items.length >= 2
}
