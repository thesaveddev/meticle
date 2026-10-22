import type { Socket } from 'socket.io-client'
import { connectChatSocket } from './chatSocket'

/**
 * The app-wide live chat feed.
 *
 * One socket for the whole signed-in session, owned by `App`, shared by every
 * screen that cares about chat. The server joins every socket to its owner's
 * `user:${userId}` room on connect and fans every message out to each member's
 * room (see `emitChatMessage` in the API), so this one socket hears every
 * conversation — no per-channel joins, no polling to discover a message.
 *
 * Two subscribers:
 *
 *   - `App` keeps the tab badge truthful, marks incoming messages delivered
 *     (the sender's double-tick) and raises a local notification unless the
 *     channel is already open.
 *   - `ChatScreen`'s channel list refreshes its previews the moment a message
 *     lands, instead of on the next 15s poll.
 *
 * The conversation view keeps its own socket for the channel-scoped signals
 * (typing, delivered, read), which still require an explicit `chat:join`.
 * Everything here is idempotent — handlers key on message id — so a message
 * heard twice (once here, once there) is applied once.
 */

export interface ChatLiveMessage {
  id: string
  channel_id?: string
  channel?: string
  sender_id: string
  sender_name?: string
  message?: string
  content?: string
  file_name?: string
  file_url?: string
  created_at?: string
}

export function chatLiveChannelOf(message: ChatLiveMessage): string | null {
  if (typeof message.channel_id === 'string' && message.channel_id) return message.channel_id
  if (typeof message.channel === 'string' && message.channel) return message.channel
  return null
}

type ChatLiveHandler = (message: ChatLiveMessage) => void

let socket: Socket | null = null
let socketToken: string | null = null
/** The channel the carer is looking at, if any — notifications skip it. */
let openChannelId: string | null = null
const handlers = new Set<ChatLiveHandler>()

function fanOut(message: ChatLiveMessage) {
  if (!message || typeof message !== 'object' || typeof message.id !== 'string') return
  for (const handler of [...handlers]) {
    try {
      handler(message)
    } catch {
      // One subscriber's failure is not the feed's failure.
    }
  }
}

type ChatUnreadTotalHandler = (count: number) => void

const unreadTotalHandlers = new Set<ChatUnreadTotalHandler>()

function fanOutUnreadTotal(payload: { count?: unknown }) {
  const count = Number(payload?.count)
  if (!Number.isFinite(count)) return
  for (const handler of [...unreadTotalHandlers]) {
    try {
      handler(Math.max(0, Math.floor(count)))
    } catch {
      // One subscriber's failure is not the feed's failure.
    }
  }
}

function wire(live: Socket) {
  live.on('chat:message', fanOut)
  live.on('chat:unread_total', fanOutUnreadTotal)
}

/**
 * Connect the shared socket for this session, or return the live one. The
 * same token reuses the same socket, so renders and screen mounts never
 * multiply connections.
 */
export function ensureChatLiveSocket(token: string): Socket {
  if (socket && socketToken === token) return socket
  try {
    socket?.disconnect()
  } catch {
    // A half-torn-down socket owes nothing.
  }
  socketToken = token
  socket = connectChatSocket(token)
  wire(socket)
  return socket
}

/** Tear the shared socket down. The app calls this on sign-out. */
export function disconnectChatLive(): void {
  try {
    socket?.disconnect()
  } catch {
    // Already gone.
  }
  socket = null
  socketToken = null
}

export function subscribeChatLive(handler: ChatLiveHandler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/**
 * The server's exact unread total, pushed on every send and every read.
 * The app sets its badge from this instead of reconciling with a GET — the
 * GET stays as the fallback for reconnects and missed pushes.
 */
export function subscribeChatUnreadTotal(handler: ChatUnreadTotalHandler): () => void {
  unreadTotalHandlers.add(handler)
  return () => {
    unreadTotalHandlers.delete(handler)
  }
}

export function setOpenChatChannel(channelId: string | null): void {
  openChannelId = channelId
}

export function getOpenChatChannel(): string | null {
  return openChannelId
}

/** Test seam: drops the socket, the handlers and the open channel. */
export function resetChatLiveForTests(): void {
  unreadTotalHandlers.clear()
  try {
    socket?.disconnect()
  } catch {
    // Nothing to end.
  }
  socket = null
  socketToken = null
  openChannelId = null
  handlers.clear()
}
