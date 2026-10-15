import type { CorsOptions } from 'cors'

/**
 * The CORS origin policy, in one place.
 *
 * It lives here rather than inline in `index.ts` because the defect it exists to
 * prevent is invisible in a running system. The rejection path used to call
 * `callback(new Error('Not allowed by CORS'))`, and `cors` passes that straight
 * to `next(err)` — so Express's terminal error handler answered **500** with an
 * "Unhandled error" log line. Nothing that a healthy user does produces a
 * foreign `Origin`, so the API looked fine to every real client while any
 * request carrying one — bot traffic, a link unfurler, a security scanner, a
 * third party's probe, and every uptime check that sets the header — was
 * reported as a server fault. Verified against production on 13 Oct 2026:
 *
 *   OPTIONS /api/health/ready  Origin: https://evil.example.com  -> 500
 *   GET     /api/health/ready  Origin: https://evil.example.com  -> 500
 *   OPTIONS /api/health/ready  (no Origin)                       -> 204
 *
 * A disallowed origin is not a server error. The browser is what enforces CORS;
 * the correct server behaviour is to omit `Access-Control-Allow-Origin` and let
 * the request complete normally, which is what `callback(null, false)` does.
 */

/** The `cors` package's origin-callback signature. */
export type OriginCallback = (err: Error | null, allow?: boolean) => void

/**
 * The origins allowed to make credentialed cross-origin requests.
 *
 * `undefined` means "no allowlist" — `cors` is configured with `origin: true`
 * and permits everything. That is deliberate in development, where the web app
 * moves between ports, and it is unreachable in production: `NODE_ENV` is
 * always set there, so the fallback list applies and the deployment fails
 * closed if `CORS_ORIGINS` is misconfigured.
 */
export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] | undefined {
  const configured = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : []

  if (configured.length > 0) return configured
  if (env.NODE_ENV === 'production') return ['https://meticlecare.com', 'https://www.meticlecare.com']
  return undefined
}

/**
 * Build the `origin` option for `cors`.
 *
 * A request with no `Origin` header is not a cross-origin request — server-side
 * callers, curl and the mobile app all omit it — so it is always allowed.
 */
export function corsOrigin(allowedOrigins: string[] | undefined): CorsOptions['origin'] {
  if (!allowedOrigins) return true

  return (origin: string | undefined, callback: OriginCallback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    // `null` error, `false` allow: no `Access-Control-Allow-Origin` is set, the
    // request completes, and the browser withholds the response from the page.
    callback(null, false)
  }
}
