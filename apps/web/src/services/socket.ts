import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let reconnectCallbacks: Array<() => void> = []

export function onReconnect(cb: () => void) {
  reconnectCallbacks.push(cb)
  return () => { reconnectCallbacks = reconnectCallbacks.filter(c => c !== cb) }
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })
  socket.on('connect', () => {
    reconnectCallbacks.forEach(cb => cb())
  })
  socket.on('connect_error', (err) => {
    console.warn('[socket] connect error:', err.message)
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
