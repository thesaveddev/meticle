import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform,
  RefreshControl, Alert, Pressable, Modal, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import {
  ensureGeneralChannel, getChatChannels, getChatMessages, sendChatMessage,
  editChatMessage, deleteChatMessage, markChatRead, getOrgMembers,
  createDMChannel, searchChatMessages
} from '../services/api'
import { hapticLight } from '../services/haptics'

type ChatChannel = {
  id: string
  name: string
  type: 'general' | 'group' | 'dm'
  other_member?: { id: string; name: string; email: string; profile_picture_url?: string } | null
  last_message?: { content: string; sender_name: string; created_at: string } | null
  unread_count: number
  member_count: number
  created_at: string | null
}

type ChatMessage = {
  id: string
  sender_id: string
  sender_name: string
  sender_email: string
  channel: string
  message: string
  reply_to_id?: string
  edited: boolean
  deleted: boolean
  created_at: string
}

type Props = {
  session?: AuthSession
  onBack?: () => void
}

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6']

function getAvatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatListTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatMsgTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function ChatScreen({ session, onBack }: Props) {
  const c = useAppColors()
  const token = session?.accessToken || ''
  const currentUserId = session?.user?.id || ''

  // View state: 'list' shows conversations, 'chat' shows messages
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // New chat modal
  const [showNewChat, setShowNewChat] = useState(false)
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)

  const flatListRef = useRef<FlatList>(null)

  // Load channels
  const loadChannels = useCallback(async () => {
    if (!token) return
    try {
      await ensureGeneralChannel(token).catch(() => {})
      const data = await getChatChannels(token)
      setChannels(data)
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadChannels() }, [loadChannels])

  // Poll for channel updates
  useEffect(() => {
    const interval = setInterval(loadChannels, 15000)
    return () => clearInterval(interval)
  }, [loadChannels])

  // Load messages for active channel
  const loadMessages = useCallback(async () => {
    if (!token || !activeChannel) return
    try {
      const msgs = await getChatMessages(token, activeChannel.id, 80)
      setMessages(msgs)
      markChatRead(token, activeChannel.id).catch(() => {})
    } catch {} finally { setLoadingMessages(false) }
  }, [token, activeChannel])

  useEffect(() => {
    if (activeChannel) {
      setLoadingMessages(true)
      loadMessages()
    }
  }, [activeChannel, loadMessages])

  // Poll messages in active chat
  useEffect(() => {
    if (view !== 'chat' || !activeChannel) return
    const interval = setInterval(loadMessages, 8000)
    return () => clearInterval(interval)
  }, [view, activeChannel, loadMessages])

  // Open a channel
  const openChannel = (ch: ChatChannel) => {
    hapticLight()
    setActiveChannel(ch)
    setView('chat')
  }

  // Go back to list
  const backToList = () => {
    hapticLight()
    setView('list')
    setActiveChannel(null)
    setMessages([])
    loadChannels()
  }

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || sending || !activeChannel) return
    setSending(true)
    const text = inputText.trim()
    setInputText('')
    try {
      const msg = await sendChatMessage(token, activeChannel.id, text)
      setMessages(prev => [...prev, msg])
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e: any) {
      setInputText(text)
      Alert.alert('Error', e.message || 'Failed to send')
    } finally { setSending(false) }
  }

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    if (view === 'list') await loadChannels()
    else await loadMessages()
    setRefreshing(false)
  }

  // Delete message
  const handleDelete = (msg: ChatMessage) => {
    if (msg.sender_id !== currentUserId) return
    Alert.alert('Delete message', 'Delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteChatMessage(token, msg.id)
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, deleted: true, message: '' } : m))
        } catch {}
      }}
    ])
  }

  // New DM
  const openNewChat = async () => {
    hapticLight()
    setShowNewChat(true)
    setLoadingMembers(true)
    try {
      const members = await getOrgMembers(token)
      setOrgMembers(members)
    } catch {} finally { setLoadingMembers(false) }
  }

  const startDM = async (member: any) => {
    hapticLight()
    setShowNewChat(false)
    setMemberSearch('')
    try {
      const ch = await createDMChannel(token, member.id)
      await loadChannels()
      // Find the channel in the refreshed list or create a local one
      const updated = await getChatChannels(token)
      const found = updated.find((c: ChatChannel) => c.id === ch.id)
      if (found) {
        setActiveChannel(found)
        setView('chat')
      } else {
        setActiveChannel({
          id: ch.id,
          name: member.name || member.email,
          type: 'dm',
          other_member: member,
          last_message: null,
          unread_count: 0,
          member_count: 2,
          created_at: new Date().toISOString(),
        })
        setView('chat')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create conversation')
    }
  }

  const filteredMembers = orgMembers.filter((m: any) => {
    if (!memberSearch.trim()) return true
    const q = memberSearch.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  // ─── RENDER: Conversations List ──────────────────────────

  const renderConversation = ({ item }: { item: ChatChannel }) => {
    const color = getAvatarColor(item.id)
    const lastMsg = item.last_message
    const preview = lastMsg ? `${lastMsg.sender_name.split(' ')[0]}: ${lastMsg.content}` : 'No messages yet'
    const time = lastMsg ? formatListTime(lastMsg.created_at) : ''

    return (
      <Pressable
        onPress={() => openChannel(item)}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderLight }, pressed && { backgroundColor: c.surfaceAlt }]}
      >
        {/* Avatar */}
        <View style={[listStyles.avatar, { backgroundColor: color }]}>
          <Text style={listStyles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[listStyles.name, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
            {time ? <Text style={[listStyles.time, { color: item.unread_count > 0 ? c.primary : c.muted }]}>{time}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={[listStyles.preview, { color: c.muted }]} numberOfLines={1}>{preview}</Text>
            {item.unread_count > 0 && (
              <View style={[listStyles.badge, { backgroundColor: c.primary }]}>
                <Text style={listStyles.badgeText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
          {item.type === 'dm' && (
            <Text style={[listStyles.typeTag, { color: c.subtle }]}>Direct message</Text>
          )}
        </View>
      </Pressable>
    )
  }

  // ─── RENDER: Message Bubble ──────────────────────────────

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.deleted) return null
    const isMe = item.sender_id === currentUserId
    const avatarColor = getAvatarColor(item.sender_id)

    return (
      <Pressable
        onLongPress={() => handleDelete(item)}
        style={[msgStyles.row, isMe && msgStyles.rowMe]}
      >
        {!isMe && (
          <View style={[msgStyles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={msgStyles.avatarText}>{getInitials(item.sender_name)}</Text>
          </View>
        )}
        <View style={[msgStyles.bubble, isMe ? msgStyles.bubbleMe : { backgroundColor: c.surface }, !isMe && { borderColor: c.borderLight, borderWidth: 1 }]}>
          {!isMe && (
            <Text style={[msgStyles.senderName, { color: avatarColor }]}>{item.sender_name}</Text>
          )}
          <Text style={[msgStyles.text, { color: isMe ? '#FFFFFF' : c.ink }]}>{item.message}</Text>
          <View style={msgStyles.footer}>
            <Text style={[msgStyles.time, { color: isMe ? '#FFFFFFAA' : c.muted }]}>{formatMsgTime(item.created_at)}</Text>
            {item.edited && <Text style={[msgStyles.edited, { color: isMe ? '#FFFFFFAA' : c.muted }]}>edited</Text>}
            {isMe && (
              <Ionicons name="checkmark-done" size={14} color="#FFFFFFAA" style={{ marginLeft: 2 }} />
            )}
          </View>
        </View>
      </Pressable>
    )
  }

  // ─── MAIN RENDER ─────────────────────────────────────────

  if (view === 'list') {
    return (
      <SafeAreaView style={[listStyles.container, dyn(c).screen]} edges={['top']}>
        {/* Header */}
        <View style={[listStyles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          {onBack ? (
            <Pressable onPress={onBack} style={listStyles.headerBtn}>
              <Ionicons name="arrow-back" size={22} color={c.ink} />
            </Pressable>
          ) : <View style={{ width: 44 }} />}
          <Text style={[listStyles.headerTitle, { color: c.ink }]}>Messages</Text>
          <Pressable onPress={openNewChat} style={listStyles.headerBtn}>
            <Ionicons name="create-outline" size={24} color={c.primary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={listStyles.centered}>
            <ActivityIndicator size="small" color={c.primary} />
          </View>
        ) : (
          <FlatList
            data={channels}
            keyExtractor={item => item.id}
            renderItem={renderConversation}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="transparent" />}
            ListEmptyComponent={
              <View style={listStyles.centered}>
                <Ionicons name="chatbubbles-outline" size={48} color={c.border} />
                <Text style={[listStyles.emptyTitle, { color: c.ink }]}>No conversations</Text>
                <Text style={[listStyles.emptySub, { color: c.muted }]}>Tap the compose button to start a chat</Text>
              </View>
            }
          />
        )}

        {/* New Chat Modal */}
        <Modal visible={showNewChat} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={[listStyles.container, { backgroundColor: c.bg }]} edges={['top']}>
            <View style={[listStyles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
              <Pressable onPress={() => { setShowNewChat(false); setMemberSearch('') }} style={listStyles.headerBtn}>
                <Ionicons name="close" size={22} color={c.ink} />
              </Pressable>
              <Text style={[listStyles.headerTitle, { color: c.ink }]}>New conversation</Text>
              <View style={{ width: 44 }} />
            </View>
            <View style={[listStyles.searchWrap, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name="search" size={18} color={c.muted} />
              <TextInput
                style={[listStyles.searchInput, { color: c.ink }]}
                placeholder="Search by name or email..."
                placeholderTextColor={c.muted}
                value={memberSearch}
                onChangeText={setMemberSearch}
                autoFocus
              />
            </View>
            {loadingMembers ? (
              <View style={listStyles.centered}><ActivityIndicator size="small" color={c.primary} /></View>
            ) : (
              <FlatList
                data={filteredMembers}
                keyExtractor={item => item.id}
                renderItem={({ item: member }) => {
                  const color = getAvatarColor(member.id)
                  return (
                    <Pressable
                      onPress={() => startDM(member)}
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderLight }, pressed && { backgroundColor: c.surfaceAlt }]}
                    >
                      <View style={[listStyles.avatar, { backgroundColor: color }]}>
                        <Text style={listStyles.avatarText}>{getInitials(member.name || member.email)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[listStyles.name, { color: c.ink }]}>{member.name || member.email}</Text>
                        <Text style={[listStyles.preview, { color: c.muted }]}>{member.role?.replace('_', ' ')}</Text>
                      </View>
                      <Ionicons name="chatbubble-outline" size={18} color={c.primary} />
                    </Pressable>
                  )
                }}
              />
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    )
  }

  // ─── RENDER: Chat View ───────────────────────────────────

  const channelColor = getAvatarColor(activeChannel?.id || '')

  return (
    <SafeAreaView style={[chatStyles.container, dyn(c).screen]} edges={['top']}>
      {/* Chat header */}
      <View style={[chatStyles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={backToList} style={chatStyles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <View style={chatStyles.headerInfo}>
          <View style={[chatStyles.headerAvatar, { backgroundColor: channelColor }]}>
            <Text style={chatStyles.headerAvatarText}>{getInitials(activeChannel?.name || '')}</Text>
          </View>
          <View>
            <Text style={[chatStyles.headerName, { color: c.ink }]} numberOfLines={1}>{activeChannel?.name}</Text>
            <Text style={[chatStyles.headerSub, { color: c.muted }]}>
              {activeChannel?.type === 'dm' ? 'Online' : `${activeChannel?.member_count || 0} members`}
            </Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Messages */}
      {loadingMessages ? (
        <View style={chatStyles.centered}>
          <ActivityIndicator size="small" color={c.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages.filter(m => !m.deleted)}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={chatStyles.messageList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="transparent" />}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={chatStyles.emptyWrap}>
              <View style={[chatStyles.emptyAvatar, { backgroundColor: channelColor }]}>
                <Text style={chatStyles.emptyAvatarText}>{getInitials(activeChannel?.name || '')}</Text>
              </View>
              <Text style={[chatStyles.emptyTitle, { color: c.ink }]}>Start a conversation</Text>
              <Text style={[chatStyles.emptySub, { color: c.muted }]}>Send a message to {activeChannel?.name}</Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={[chatStyles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <TextInput
            style={[chatStyles.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={c.muted}
            multiline
            maxLength={5000}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[chatStyles.sendBtn, { backgroundColor: inputText.trim() ? c.primary : c.border }]}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles: Conversations List ───────────────────────────

const listStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...type.title, fontSize: 18 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.base,
    marginTop: spacing.sm, marginBottom: spacing.xs, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  searchInput: { flex: 1, ...type.body, fontSize: 15 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: FONT },
  name: { fontSize: 16, fontWeight: '600', fontFamily: FONT },
  preview: { fontSize: 14, fontFamily: FONT, flex: 1 },
  time: { fontSize: 12, fontFamily: FONT, marginLeft: spacing.sm },
  badge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', fontFamily: FONT },
  typeTag: { fontSize: 11, fontFamily: FONT, marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONT, marginTop: spacing.md },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center' },
})

// ─── Styles: Chat View ───────────────────────────────────

const chatStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, gap: spacing.xs,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', fontFamily: FONT },
  headerName: { fontSize: 16, fontWeight: '600', fontFamily: FONT },
  headerSub: { fontSize: 12, fontFamily: FONT },
  messageList: { padding: spacing.base, paddingBottom: spacing.sm, gap: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: 1, gap: spacing.sm,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, fontSize: 15, fontFamily: FONT, maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base },
  emptyAvatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', fontFamily: FONT },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONT, marginBottom: spacing.xs },
  emptySub: { fontSize: 14, fontFamily: FONT },
})

// ─── Styles: Message Bubbles ──────────────────────────────

const msgStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginBottom: spacing.sm, maxWidth: '82%' },
  rowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', fontFamily: FONT },
  bubble: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 18, borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    borderBottomLeftRadius: 18, borderBottomRightRadius: 4,
  },
  senderName: { fontSize: 12, fontWeight: '600', fontFamily: FONT, marginBottom: 2 },
  text: { fontSize: 15, lineHeight: 20, fontFamily: FONT },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  time: { fontSize: 11, fontFamily: FONT },
  edited: { fontSize: 11, fontFamily: FONT, fontStyle: 'italic' },
})
