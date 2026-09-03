import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

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
      if (!skipPaths.some(p => originalRequest.url.includes(p))) {
        onApiError?.(getErrorMessage(error))
      }
    }

    return Promise.reject(error)
  }
)

export default api
