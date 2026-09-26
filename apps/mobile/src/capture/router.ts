/**
 * The fetch replacement that serves the capture fixtures.
 *
 * Routing happens on `METHOD /path` with the query string dropped, because a
 * capture run asks for the same screen twice with different dates and both
 * requests want the same answer. Anything the fixtures do not cover is recorded
 * and answered 404 rather than quietly returning an empty list: a screen that
 * silently gets `[]` still renders, so a missing fixture shows up as a subtly
 * empty screenshot instead of an obvious error, and that is exactly the kind of
 * defect this is meant to catch. `src/capture/__tests__/router.test.ts` asserts
 * that nothing is missing.
 */

export interface CaptureRoute {
  status: number
  body: unknown
}

export interface CaptureRouter {
  handle: (method: string, url: string) => CaptureRoute
  /** `METHOD /path` for every request the fixtures did not answer. */
  misses: () => string[]
}

/**
 * The request path a fixture key is written against. The API base is
 * configurable and deployed behind `/api`, so the prefix is dropped rather than
 * repeated in every fixture key — and a key never has to change when the
 * deployment path does.
 */
export function normalisePath(url: string): string {
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/, '')
  const withoutQuery = withoutOrigin.split('?')[0] || '/'
  return withoutQuery.replace(/^\/api(?=\/|$)/, '') || '/'
}

/** Segments that carry an id are matched by pattern rather than by value. */
function toMatcher(key: string): RegExp | null {
  const space = key.indexOf(' ')
  if (space < 0) return null
  const method = key.slice(0, space)
  const path = key.slice(space + 1)
  if (!/^[A-Z]+$/.test(method) || !path.startsWith('/')) return null
  const pattern = path
    .split('/')
    .map((segment, index) => {
      // The leading empty segment is the root slash, not an id.
      if (segment === '' && index === 0) return ''
      return /^[A-Za-z0-9_-]+$/.test(segment) ? segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '[^/]+'
    })
    .join('/')
  return new RegExp(`^${pattern}$`)
}

interface CompiledRoute {
  key: string
  method: string
  matcher: RegExp
  body: unknown
}

export function createCaptureRouter(routes: Record<string, unknown>): CaptureRouter {
  const compiled: CompiledRoute[] = []
  const missing = new Set<string>()

  for (const [key, body] of Object.entries(routes)) {
    const matcher = toMatcher(key)
    if (!matcher) throw new Error(`Capture route "${key}" must look like "GET /path"`)
    compiled.push({ key, method: key.slice(0, key.indexOf(' ')), matcher, body })
  }

  // Longer paths first, so `/people/x/daily-notes` wins over `/people/x`
  // whichever order the fixtures were written in.
  compiled.sort((a, b) => b.matcher.source.length - a.matcher.source.length)

  return {
    handle(method: string, url: string): CaptureRoute {
      const requestMethod = (method || 'GET').toUpperCase()
      const path = normalisePath(url)
      for (const route of compiled) {
        if (route.method !== requestMethod) continue
        if (!route.matcher.test(path)) continue
        return { status: 200, body: route.body }
      }
      missing.add(`${requestMethod} ${path}`)
      return { status: 404, body: { message: `No capture fixture for ${requestMethod} ${path}` } }
    },
    misses: () => [...missing].sort(),
  }
}

/** A `fetch` that answers from the router and never touches the network. */
export function createCaptureFetch(router: CaptureRouter): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method || (typeof input === 'object' && !(input instanceof URL) ? input.method : undefined) || 'GET'
    const { status, body } = router.handle(String(method).toUpperCase(), url)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
}
