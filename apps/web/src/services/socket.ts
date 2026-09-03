import { io, Socket } from 'socket.io-client'
import { refreshAccessToken } from './api'

let socket: Socket | null = null
let reconnectCallbacks: Array<() => void> = []
let getToken: () => string | null = () => localStorage.getItem('accessToken')
let lastAuthRetry = 0
let hasConnected = false

export function onReconnect(cb: () => void) {
  reconnectCallbacks.push(cb)
  return () => { reconnectCallbacks = reconnectCallbacks.filter(c => c !== cb) }
}

function isAuthError(message: string): boolean {
  return /token|authenticat|permissions changed|revoked|deactivated|no longer exists|invalid/i.test(message || '')
}

function resumeIfDisconnected() {
  if (socket && !socket.connected) {
    socket.connect()
  }
}

export function connectSocket(tokenProvider: (() => string | null) | null = null): Socket {
  if (socket?.connected) return socket
  getToken = tokenProvider || (() => localStorage.getItem('accessToken'))
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
  socket = io(url, {
    // Re-evaluated on every (re)connection attempt so a refreshed access token
    // is always used — otherwise push notifications die on reconnect.
    auth: (cb) => cb({ token: getToken() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })
  socket.on('connect', () => {
    // Only fire reconnect callbacks after a genuine reconnect — the first
    // connection should not re-trigger data reloads for every mounted page.
    if (hasConnected) {
      reconnectCallbacks.forEach(cb => { try { cb() } catch { /* keep going */ } })
    }
    hasConnected = true
  })
  socket.on('connect_error', async (err) => {
    console.warn('[socket] connect error:', err.message)
    if (!socket || !isAuthError(err.message)) return
    // Avoid hammering the refresh endpoint on repeated failures.
    const now = Date.now()
    if (now - lastAuthRetry < 30000) return
    lastAuthRetry = now
    let fresh: string | null = null
    try { fresh = await refreshAccessToken() } catch { /* app interceptor handles session expiry */ }
    if (fresh && socket) {
      // auth is functional (getToken reads the fresh token from localStorage),
      // so a simple reconnect is enough — do not overwrite socket.auth.
      socket.disconnect()
      socket.connect()
    }
  })
  socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnected:', reason)
  })

  // Resume the connection when the tab becomes visible again (mobile sleep,
  // backgrounded tabs, etc.) instead of relying solely on the reconnect backoff.
  if (!import.meta.env.SSR && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', resumeIfDisconnected)
  }

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', resumeIfDisconnected)
  }
  reconnectCallbacks = []
  hasConnected = false
}

export function getSocket(): Socket | null {
  return socket
}
