import { io, Socket } from 'socket.io-client'
import { refreshAccessToken } from './api'

let socket: Socket | null = null
let reconnectCallbacks: Array<() => void> = []
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

export function connectSocket(): Socket {
  if (socket?.connected) return socket
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
  socket = io(url, {
    // The session is an httpOnly cookie, so there is no token to hand over in an
    // `auth` payload and none that can go stale in one: `withCredentials` is what
    // makes the browser send the cookie on the handshake, exactly as it does on
    // an API request. The server accepts either the cookie or an `auth` token,
    // which is how the mobile app still authenticates.
    withCredentials: true,
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
    try {
      // Rotates the session cookie in place. There is no token to store or to
      // re-attach, so the reconnect below is the whole recovery.
      await refreshAccessToken()
      socket.disconnect()
      socket.connect()
    } catch { /* app interceptor handles session expiry */ }
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
