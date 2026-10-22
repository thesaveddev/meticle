/**
 * The app-wide chat feed: one socket per session, fanning every incoming
 * message out to each subscriber exactly once, and remembering which channel
 * is open so notifications can skip it.
 */
import {
  chatLiveChannelOf,
  disconnectChatLive,
  ensureChatLiveSocket,
  getOpenChatChannel,
  resetChatLiveForTests,
  setOpenChatChannel,
  subscribeChatLive,
} from '../chatLive'
import { connectChatSocket } from '../chatSocket'

jest.mock('../chatSocket', () => ({
  connectChatSocket: jest.fn(),
}))

const mockConnect = connectChatSocket as jest.Mock

/** A controllable stand-in for the socket.io client. */
function fakeSocket() {
  const listeners = new Map<string, Array<(data: any) => void>>()
  return {
    listeners,
    on: jest.fn((event: string, handler: (data: any) => void) => {
      const list = listeners.get(event) || []
      list.push(handler)
      listeners.set(event, list)
    }),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    feed(event: string, data: any) {
      for (const handler of listeners.get(event) || []) handler(data)
    },
  }
}

beforeEach(() => {
  resetChatLiveForTests()
  mockConnect.mockReset()
})

describe('ensureChatLiveSocket', () => {
  it('connects once per token and reuses the socket', () => {
    const first = fakeSocket()
    mockConnect.mockReturnValue(first as any)

    expect(ensureChatLiveSocket('token-1')).toBe(first)
    expect(ensureChatLiveSocket('token-1')).toBe(first)
    expect(mockConnect).toHaveBeenCalledTimes(1)

    const second = fakeSocket()
    mockConnect.mockReturnValue(second as any)
    expect(ensureChatLiveSocket('token-2')).toBe(second)
    expect(first.disconnect).toHaveBeenCalled()
  })
})

describe('subscribeChatLive', () => {
  it('fans an incoming message out to every subscriber, each exactly once', () => {
    const live = fakeSocket()
    mockConnect.mockReturnValue(live as any)
    ensureChatLiveSocket('token-1')

    const seen: string[][] = [[], []]
    const unsubFirst = subscribeChatLive(msg => { seen[0].push(msg.id) })
    subscribeChatLive(msg => { seen[1].push(msg.id) })

    live.feed('chat:message', { id: 'm1', channel_id: 'chan-1', sender_id: 'them', message: 'Hi' })

    expect(seen).toEqual([['m1'], ['m1']])

    unsubFirst()
    live.feed('chat:message', { id: 'm2', channel_id: 'chan-1', sender_id: 'them', message: 'Again' })

    expect(seen).toEqual([['m1'], ['m1', 'm2']])
  })

  it('ignores payloads that are not messages', () => {
    const live = fakeSocket()
    mockConnect.mockReturnValue(live as any)
    ensureChatLiveSocket('token-1')

    const seen: string[] = []
    subscribeChatLive(msg => { seen.push(msg.id) })

    live.feed('chat:message', null)
    live.feed('chat:message', { channel_id: 'chan-1' })
    live.feed('chat:message', 'not-an-object' as any)

    expect(seen).toEqual([])
  })

  it('a failing subscriber does not starve the rest', () => {
    const live = fakeSocket()
    mockConnect.mockReturnValue(live as any)
    ensureChatLiveSocket('token-1')

    const seen: string[] = []
    subscribeChatLive(() => { throw new Error('boom') })
    subscribeChatLive(msg => { seen.push(msg.id) })

    live.feed('chat:message', { id: 'm1', channel_id: 'chan-1', sender_id: 'them' })

    expect(seen).toEqual(['m1'])
  })
})

describe('open channel tracking', () => {
  it('starts with no channel open and remembers what is set', () => {
    expect(getOpenChatChannel()).toBeNull()
    setOpenChatChannel('chan-9')
    expect(getOpenChatChannel()).toBe('chan-9')
    setOpenChatChannel(null)
    expect(getOpenChatChannel()).toBeNull()
  })
})

describe('chatLiveChannelOf', () => {
  it('reads the channel from either payload shape', () => {
    expect(chatLiveChannelOf({ id: 'm', sender_id: 'u', channel_id: 'a' })).toBe('a')
    expect(chatLiveChannelOf({ id: 'm', sender_id: 'u', channel: 'b' })).toBe('b')
    expect(chatLiveChannelOf({ id: 'm', sender_id: 'u' })).toBeNull()
  })
})

describe('disconnectChatLive', () => {
  it('ends the socket so sign-out leaves nothing connected', () => {
    const live = fakeSocket()
    mockConnect.mockReturnValue(live as any)
    ensureChatLiveSocket('token-1')

    disconnectChatLive()

    expect(live.disconnect).toHaveBeenCalled()
    const next = fakeSocket()
    mockConnect.mockReturnValue(next as any)
    ensureChatLiveSocket('token-1')
    expect(mockConnect).toHaveBeenCalledTimes(2)
  })
})
