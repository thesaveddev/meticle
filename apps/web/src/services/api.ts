import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Suppress the global error toast for this request — the caller handles failures itself. */
    silentError?: boolean
  }
}

type ErrorHandler = (message: string) => void
let onApiError: ErrorHandler | null = null

export function setOnApiError(handler: ErrorHandler) {
  onApiError = handler
}

let refreshPromise: Promise<string> | null = null

function isPortalRequest(url?: string): boolean {
  return !!url && (url.includes('/compliance-portal/portal/verify') || url.includes('/compliance-portal/portal/dashboard') || url.includes('/compliance-portal/portal/person/'))
}

function getErrorMessage(error: any): string {
  if (error.response?.data?.message) return error.response.data.message
  if (error.response?.data?.error?.message) return error.response.data.error.message
  if (error.message) return error.message
  return 'An unexpected error occurred'
}

function clearAppSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return Promise.reject(new Error('No refresh token available'))

  refreshPromise = axios.post('/api/auth/refresh', { refreshToken }, { withCredentials: true })
    .then(({ data }) => {
      if (!data.accessToken) throw new Error('Refresh response did not include an access token')
      localStorage.setItem('accessToken', data.accessToken)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      return data.accessToken as string
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

api.interceptors.request.use((config) => {
  // Portal tokens apply only to portal endpoints. A stale portal token must
  // never override the signed-in user's application token.
  const token = isPortalRequest(config.url)
    ? localStorage.getItem('portal_token')
    : localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh logic for auth endpoints (login, register, refresh)
      const authPaths = ['/auth/login', '/auth/register', '/auth/refresh']
      if (authPaths.some(p => originalRequest.url?.includes(p))) {
        return Promise.reject(error)
      }

      // Portal users: clear token and redirect to portal login (not app login)
      const isPortal = isPortalRequest(originalRequest.url)
      if (isPortal) {
        localStorage.removeItem('portal_token')
        window.location.href = '/portal/login?error=session_expired'
        return Promise.reject(error)
      }

      originalRequest._retry = true

      try {
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        clearAppSession()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // Handle 403 subscription expired — redirect to billing with context
    if (error.response?.status === 403 && error.response?.data?.redirect) {
      const redirectPath = error.response.data.redirect
      const msg = error.response.data.message || 'Your subscription needs attention'
      // Don't redirect if already on billing or if this is a portal request
      const isPortal = isPortalRequest(originalRequest?.url)
      if (!isPortal && !window.location.pathname.startsWith(redirectPath)) {
        localStorage.setItem('redirectReason', 'subscription_expired')
        localStorage.setItem('subscriptionMessage', msg)
        window.location.href = redirectPath + '?reason=subscription_expired'
      }
      return Promise.reject(error)
    }

    if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && originalRequest?.url) {
      const skipPaths = ['/auth/me', '/auth/login', '/auth/register', '/billing']
      if (!originalRequest.silentError && !skipPaths.some(p => originalRequest.url.includes(p))) {
        onApiError?.(getErrorMessage(error))
      }
    }

    return Promise.reject(error)
  }
)

/**
 * How long a rate-limited request asked us to wait, in milliseconds.
 *
 * Returns null when this is not a rate limit worth riding out, which is the
 * important half of the contract. The API sends two quite different 429s and
 * they must not be treated alike:
 *
 *   - The per-IP middleware in `rateLimit.middleware.ts` sets `Retry-After`
 *     and includes `retryAfterSeconds` in the body. This one is a few seconds
 *     of congestion behind us.
 *   - The per-recipient caps in the auth controller (three verification codes
 *     per address per 15 minutes, and so on) carry no hint at all, because
 *     waiting is not what the caller should do. Retrying automatically would
 *     park someone on a form for a quarter of an hour, and each attempt would
 *     burn one of the three codes they are allowed to find out the same thing
 *     again.
 *
 * So the presence of a retry hint is the discriminator, not the status code.
 */
export function rateLimitRetryDelayMs(error: any, jitterMs = 0): number | null {
  const response = error?.response
  if (!response || response.status !== 429) return null

  const header = response.headers?.['retry-after'] ?? response.headers?.['Retry-After']
  const body = response.data?.retryAfterSeconds
  const seconds = Number(header ?? body)
  if (!Number.isFinite(seconds) || seconds <= 0) return null

  return Math.ceil(seconds * 1000) + jitterMs
}

/** The message to show when a rate limit refuses to be waited out. */
export function rateLimitMessage(error: any, fallback: string): string {
  const seconds = Number(error?.response?.headers?.['retry-after'] ?? error?.response?.data?.retryAfterSeconds)
  if (Number.isFinite(seconds) && seconds > 0) {
    if (seconds <= 60) return `Too many people are signing up at once. Please try again in ${Math.ceil(seconds)} seconds.`
    return `Too many attempts. Please try again in ${Math.ceil(seconds / 60)} minutes.`
  }
  return error?.response?.data?.message || fallback
}

type RetryOptions = {
  /** Attempts after the first. Each costs one round trip plus the wait. */
  maxRetries?: number
  /** Give up rather than exceed this much total waiting. */
  budgetMs?: number
  /** Injected in tests so the suite does not actually wait. */
  sleep?: (ms: number) => Promise<void>
  /** Injected in tests to keep jitter out of the assertions. */
  jitterMs?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Run `fn`, transparently waiting out a per-IP rate limit.
 *
 * A care home is one office on one NAT address, so activating a customer means
 * 15-30 of their staff requesting a verification code within the same minute.
 * The server caps that per IP to bound abuse, and it tells us how long to wait
 * via `Retry-After`. Treating that 429 as a hard failure meant the people who
 * happened to click during the burst were shown an error and gave up, even
 * though a few seconds later the request would have succeeded.
 *
 * Retrying here is safe in a way that it would not be for most endpoints: a
 * middleware 429 rejects before the controller runs, so a retry that succeeds
 * sends exactly one email, and a retry that fails again sends none. No
 * duplicate codes, and none of the user's per-recipient allowance is spent.
 *
 * The wait is not unbounded. If the server asks for longer than the remaining
 * budget the call rejects immediately and the caller shows `rateLimitMessage`,
 * because a person would rather read "try again in 2 minutes" than sit
 * watching a button for two minutes.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 2, budgetMs = 45_000, sleep = defaultSleep, jitterMs = () => Math.floor(Math.random() * 250) } = options

  let waited = 0
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries) throw error

      const delay = rateLimitRetryDelayMs(error, jitterMs())
      // No hint, or a wait we cannot afford to sit through: surface it now.
      if (delay === null || waited + delay > budgetMs) throw error

      await sleep(delay)
      waited += delay
    }
  }
}

export default api
