import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

type ErrorHandler = (message: string) => void
let onApiError: ErrorHandler | null = null

export function setOnApiError(handler: ErrorHandler) {
  onApiError = handler
}

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = []

function getErrorMessage(error: any): string {
  if (error.response?.data?.message) return error.response.data.message
  if (error.response?.data?.error?.message) return error.response.data.error.message
  if (error.message) return error.message
  return 'An unexpected error occurred'
}

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (token) {
      prom.resolve(token)
    } else {
      prom.reject(error)
    }
  })
  failedQueue = []
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh logic for auth endpoints (login, register, refresh)
      const authPaths = ['/auth/login', '/auth/register', '/auth/refresh']
      if (authPaths.some(p => originalRequest.url?.includes(p))) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken)
        }
        processQueue(null, data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
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
