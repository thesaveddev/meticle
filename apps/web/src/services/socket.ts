import { io, Socket } from 'socket.io-client'
import axios from 'axios'

let socket: Socket | null = null
let reconnectCallbacks: Array<() => void> = []
let getToken: () => string | null = () => localStorage.getItem('accessToken')
let lastAuthRetry = 0

export function onReconnect(cb: () => void) {
  reconnectCallbacks.push(cb)
  return () => { reconnectCallbacks = reconnectCallbacks.filter(c => c !== cb) }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null
  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken }, { withCredentials: true })
    localStorage.setItem('accessToken', data.accessToken)
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken)
    }
    return data.accessToken as string
  } catch {
    return null
  }
}

function isAuthError(message: string): boolean {
  return /token|authenticat|permissions changed|revoked|deactivated|no longer exists|invalid/i.test(message || '')
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
    reconnectCallbacks.forEach(cb => cb())
  })
  socket.on('connect_error', async (err) => {
    console.warn('[socket] connect error:', err.message)
    if (!socket || !isAuthError(err.message)) return
    // Avoid hammering the refresh endpoint on repeated failures.
    const now = Date.now()
    if (now - lastAuthRetry < 30000) return
    lastAuthRetry = now
    const fresh = await refreshAccessToken()
    if (fresh && socket) {
      socket.auth = { token: fresh }
      socket.disconnect()
      socket.connect()
    }
  })
  socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnected:', reason)
  })
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
  reconnectCallbacks = []
}

export function getSocket(): Socket | null {
  return socket
}
