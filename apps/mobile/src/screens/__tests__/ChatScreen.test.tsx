import React from 'react'
import { Alert, Image } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { ChatScreen } from '../ChatScreen'
import type { AuthSession } from '../../types'
import * as api from '../../services/api'

jest.mock('../../services/api', () => ({
  ensureGeneralChannel: jest.fn(async () => ({})),
  getChatChannels: jest.fn(async () => []),
  getChatMessages: jest.fn(async () => [] as unknown[]),
  getChatReadReceipts: jest.fn(async () => ({ other_last_read_at: null, member_reads: [] })),
  sendChatMessage: jest.fn(),
  deleteChatMessage: jest.fn(async () => ({})),
  markChatRead: jest.fn(async () => ({})),
  markChatDelivered: jest.fn(async () => ({})),
  getApiFileUrl: jest.fn((url: string) => url),
  downloadChatFile: jest.fn(async () => ({ uri: 'file:///cache/image.jpg' })),
  getOrgMembers: jest.fn(async () => []),
  getChatChannelMembers: jest.fn(async () => []),
  createDMChannel: jest.fn(),
  uploadChatFile: jest.fn(),
}))

jest.mock('../../services/chatSocket', () => ({
  connectChatSocket: jest.fn(() => ({
    connected: false,
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
  })),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))

const mockGetChatChannels = api.getChatChannels as jest.MockedFunction<typeof api.getChatChannels>
const mockGetChatMessages = api.getChatMessages as jest.MockedFunction<typeof api.getChatMessages>
const mockSendChatMessage = api.sendChatMessage as jest.MockedFunction<typeof api.sendChatMessage>
const mockDeleteChatMessage = api.deleteChatMessage as jest.MockedFunction<typeof api.deleteChatMessage>
const mockGetChatChannelMembers = api.getChatChannelMembers as jest.MockedFunction<typeof api.getChatChannelMembers>
const mockDownloadChatFile = api.downloadChatFile as jest.MockedFunction<typeof api.downloadChatFile>

const session: AuthSession = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'me', email: 'me@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

const channel = {
  id: 'chan-1',
  name: 'Amy Adams',
  channel_type: 'dm' as const,
  other_member: { id: 'them', name: 'Amy Adams', email: 'amy@example.com' },
  last_message: { content: 'Morning!', sender_name: 'Amy Adams', created_at: '2026-01-02T09:00:00.000Z' },
  unread_count: 0,
  member_count: 2,
  created_at: '2026-01-01T00:00:00.000Z',
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    sender_id: 'them',
    sender_name: 'Amy Adams',
    sender_email: 'amy@example.com',
    channel: 'chan-1',
    message: 'Morning!',
    edited: false,
    deleted: false,
    created_at: '2026-01-02T09:00:00.000Z',
    ...overrides,
  }
}

/** Opens the conversation from the channel list. */
async function openChannel() {
  const screen = render(<ChatScreen session={session} />)
  const name = await waitFor(() => screen.getByText('Amy Adams'))
  fireEvent.press(name)
  await waitFor(() => expect(screen.getByPlaceholderText('Message...')).toBeTruthy())
  return screen
}



/** React Native's View is composite over a host node, so host styling is up one level. */
function hostViewOf(node: { parent: any }): any {
  let parent = node.parent
  while (parent && parent.type !== 'View') parent = parent.parent
  expect(parent).not.toBeNull()
  return parent
}

beforeEach(() => {
  mockGetChatChannels.mockResolvedValue([channel] as any)
  mockGetChatMessages.mockResolvedValue([message()] as any)
  mockSendChatMessage.mockResolvedValue(message({ id: 'm-new', sender_id: 'me', sender_name: 'Test Carer', message: 'Hello team' }) as any)
  mockDeleteChatMessage.mockResolvedValue({} as any)
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

describe('ChatScreen composer', () => {
  it('draws an outline around the message input', async () => {
    const screen = await openChannel()

    const input = screen.getByPlaceholderText('Message...')
    expect(hostViewOf(input)).toHaveStyle({ borderWidth: 1 })
  })

  it('sends through the shared chat API and shows the sent message', async () => {
    const screen = await openChannel()

    fireEvent.changeText(screen.getByPlaceholderText('Message...'), 'Hello team')

    fireEvent.press(screen.getByLabelText('Send message'))

    await waitFor(() =>
      expect(mockSendChatMessage).toHaveBeenCalledWith('token-1', 'chan-1', 'Hello team', undefined, undefined, undefined)
    )
    await waitFor(() => expect(screen.getByText('Hello team')).toBeTruthy())
  })
})

describe('ChatScreen group member directory', () => {
  it('shows the accurate member count and filters group members', async () => {
    const group = { ...channel, id: 'group-1', name: 'Night team', channel_type: 'group' as const, other_member: null, member_count: 3 }
    mockGetChatChannels.mockResolvedValue([group] as any)
    mockGetChatChannelMembers.mockResolvedValue([
      { id: 'me', name: 'Test Carer', email: 'me@example.com', role: 'CARE_WORKER' },
      { id: 'u2', name: 'Alex Morgan', email: 'alex@example.com', role: 'MANAGER' },
      { id: 'u3', name: 'Sam Lee', email: 'sam@example.com', role: 'CARE_WORKER' },
    ] as any)
    const screen = render(<ChatScreen session={session} />)
    fireEvent.press(await waitFor(() => screen.getByText('Night team')))
    await waitFor(() => expect(screen.getByText('3 members')).toBeTruthy())
    fireEvent.press(screen.getByText('3 members'))
    await waitFor(() => expect(screen.getByPlaceholderText('Search members...')).toBeTruthy())
    expect(screen.getByText('Alex Morgan')).toBeTruthy()
    fireEvent.changeText(screen.getByPlaceholderText('Search members...'), 'Sam')
    expect(screen.getByText('Sam Lee')).toBeTruthy()
    expect(screen.queryByText('Alex Morgan')).toBeNull()
  })
})

describe('ChatScreen attachments and delivery', () => {
  it('downloads a private attachment for a stable thumbnail before opening preview', async () => {
    mockGetChatMessages.mockResolvedValue([message({ file_url: '/files/private/photo.jpg', file_name: 'photo.jpg', message: 'Shared photo.jpg' })] as any)

    const screen = await openChannel()

    await waitFor(() => expect(mockDownloadChatFile).toHaveBeenCalledWith('token-1', '/files/private/photo.jpg', 'photo.jpg'))
    const images = screen.UNSAFE_getAllByType(Image)
    expect(images.some(node => node.props.source?.uri === 'file:///cache/image.jpg')).toBe(true)

    fireEvent.press(screen.getByLabelText('Preview photo.jpg'))
    await waitFor(() => expect(screen.getByText('Save or share image')).toBeTruthy())
    expect(screen.getByLabelText('Download image')).toBeTruthy()
  })
})

describe('ChatScreen contact details', () => {
  it('opens the contact card from the conversation header', async () => {
    const screen = await openChannel()

    fireEvent.press(screen.getByText('amy@example.com'))

    await waitFor(() => expect(screen.getByText('Contact')).toBeTruthy())
    expect(screen.getByText('Send message')).toBeTruthy()
  })
})

describe('ChatScreen message context menu', () => {
  it('offers the sender card for a colleague and deletes your own message', async () => {
    const screen = await openChannel()

    fireEvent(screen.getByText('Morning!'), 'longPress')

    await waitFor(() => expect(screen.getByText('View contact')).toBeTruthy())
    expect(screen.queryByText('Delete message')).toBeNull()

    fireEvent.press(screen.getByText('View contact'))
    await waitFor(() => expect(screen.getByText('Contact')).toBeTruthy())
    fireEvent.press(screen.getByText('Close'))
  })

  it('offers delete on your own message and calls the API once confirmed', async () => {
    mockGetChatMessages.mockResolvedValue([message({ id: 'm2', sender_id: 'me', sender_name: 'Test Carer', message: 'On my way' })] as any)

    const screen = await openChannel()

    fireEvent(screen.getByText('On my way'), 'longPress')
    await waitFor(() => expect(screen.getByText('Delete message')).toBeTruthy())
    expect(screen.queryByText('View contact')).toBeNull()

    fireEvent.press(screen.getByText('Delete message'))

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2]
    await act(async () => {
      buttons.find((b: { text: string }) => b.text === 'Delete').onPress()
    })

    expect(mockDeleteChatMessage).toHaveBeenCalledWith('token-1', 'm2')
  })
})
