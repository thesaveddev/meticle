import React from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
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
  last_message: 'Morning!',
  last_message_at: '2026-01-02T09:00:00.000Z',
  unread_count: 0,
  member_count: 2,
  created_at: '2026-01-01T00:00:00.000Z',
}

/** React Native's View is composite over a host node, so host styling is up one level. */
function hostViewOf(node: { parent: any }): any {
  let parent = node.parent
  while (parent && parent.type !== 'View') parent = parent.parent
  expect(parent).not.toBeNull()
  return parent
}

/** Flattened fixed-width styles of a row's direct children (the control slots). */
function slotsOf(node: any) {
  return node.children
    .map((child: any) => StyleSheet.flatten(child?.props?.style) ?? {})
    .filter((style: Record<string, unknown>) => typeof style.width === 'number')
}

/**
 * The header row that contains the given title, as a host View. The nearest row
 * ancestor that flanks its title with two fixed-width controls: the conversation
 * nests the name inside a row of its own (avatar | name), which is not it.
 */
function headerOf(screen: ReturnType<typeof render>, title: string) {
  let node: any = hostViewOf(screen.getByText(title))
  while (node) {
    if (StyleSheet.flatten(node.props?.style)?.flexDirection === 'row' && slotsOf(node).length === 2) {
      return node
    }
    node = node.parent
  }
  throw new Error(`No header row with two fixed-width controls around "${title}"`)
}

/**
 * The two control slots flanking a header title, flattened. They must be the same
 * width, or the title between them sits off-centre.
 */
function headerSlots(screen: ReturnType<typeof render>, title: string) {
  return slotsOf(headerOf(screen, title))
}

async function openConversation() {
  const screen = render(<ChatScreen session={session} />)
  fireEvent.press(await waitFor(() => screen.getByText('Amy Adams')))
  await waitFor(() => expect(screen.getByPlaceholderText('Message...')).toBeTruthy())
  return screen
}

beforeEach(() => {
  mockGetChatChannels.mockResolvedValue([channel] as never)
})

describe('ChatScreen status bar clearance', () => {
  // The list view used to be a bare View and the conversation a bare
  // KeyboardAvoidingView, so both headers drew underneath the clock and battery.
  // The screen then carried its own top inset — and was mounted two different
  // ways, as a tab and as a stack screen, each of which now supplies the inset.
  // So the screen must not supply one as well, and this asserts that it renders
  // both views without reaching for one. App.test.tsx checks the other half:
  // that both mounts do supply it.
  it('draws the channel list without applying a top inset of its own', async () => {
    const screen = render(<ChatScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Messages')).toBeTruthy())

    expect(screen.UNSAFE_queryAllByType(SafeAreaView)).toHaveLength(0)
  })

  it('draws the conversation without applying a top inset of its own', async () => {
    const screen = await openConversation()

    expect(screen.getByPlaceholderText('Message...')).toBeTruthy()
    expect(screen.UNSAFE_queryAllByType(SafeAreaView)).toHaveLength(0)
  })
})

describe('ChatScreen header layout', () => {
  it('centres the list title between two equally sized header slots', async () => {
    const screen = render(<ChatScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Messages')).toBeTruthy())

    expect(screen.getByText('Messages')).toHaveStyle({ flex: 1, textAlign: 'center' })
    for (const slot of headerSlots(screen, 'Messages')) {
      expect(slot).toMatchObject({ width: 44, height: 44, alignItems: 'center' })
    }
  })

  // The conversation header is back arrow | name | overflow menu. The two
  // controls were unequal, which is what tilted the name off-centre.
  it('sizes both conversation header controls to the same 44pt slot', async () => {
    const screen = await openConversation()

    for (const control of headerSlots(screen, 'Amy Adams')) {
      expect(control).toMatchObject({ width: 44, height: 44, alignItems: 'center' })
    }
  })
})
