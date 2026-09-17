import { io, type Socket } from 'socket.io-client'
import { getApiOrigin } from './api'

export function connectChatSocket(token: string): Socket {
  return io(getApiOrigin(), {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  })
}
