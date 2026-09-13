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
  createDMChannel
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

  const [view, setView] = useState<'list' | 'chat'>('list')
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [showNewChat, setShowNewChat] = useState(false)
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)

  const flatListRef = useRef<FlatList>(null)

  const loadChannels = useCallback(async () => {
    if (!token) return
    try {
      await ensureGeneralChannel(token).catch(() => {})
      const data = await getChatChannels(token)
      if (Array.isArray(data)) setChannels(data)
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadChannels() }, [loadChannels])
  useEffect(() => {
    const interval = setInterval(loadChannels, 15000)
    return () => clearInterval(interval)
  }, [loadChannels])

  const loadMessages = useCallback(async () => {
    if (!token || !activeChannel) return
    try {
      const msgs = await getChatMessages(token, activeChannel.id, 80)
      if (Array.isArray(msgs)) setMessages(msgs)
      markChatRead(token, activeChannel.id).catch(() => {})
    } catch {} finally { setLoadingMessages(false) }
  }, [token, activeChannel])

  useEffect(() => {
    if (activeChannel) { setLoadingMessages(true); loadMessages() }
  }, [activeChannel, loadMessages])

  useEffect(() => {
    if (view !== 'chat' || !activeChannel) return
    const interval = setInterval(loadMessages, 8000)
    return () => clearInterval(interval)
  }, [view, activeChannel, loadMessages])

  const openChannel = (ch: ChatChannel) => {
    hapticLight()
    setActiveChannel(ch)
    setView('chat')
  }

  const backToList = () => {
    hapticLight()
    setView('list')
    setActiveChannel(null)
    setMessages([])
    loadChannels()
  }

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

  const handleRefresh = async () => {
    setRefreshing(true)
    if (view === 'list') await loadChannels()
    else await loadMessages()
    setRefreshing(false)
  }

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

  const openNewChat = async () => {
    hapticLight()
    setShowNewChat(true)
    setLoadingMembers(true)
    try {
      const members = await getOrgMembers(token)
      if (Array.isArray(members)) setOrgMembers(members)
    } catch {} finally { setLoadingMembers(false) }
  }

  const startDM = async (member: any) => {
    hapticLight()
    setShowNewChat(false)
    setMemberSearch('')
    try {
      const ch = await createDMChannel(token, member.id)
      const updated = await getChatChannels(token)
      const found = Array.isArray(updated) ? updated.find((cc: ChatChannel) => cc.id === ch.id) : null
      if (found) {
        setActiveChannel(found)
      } else {
        setActiveChannel({
          id: ch.id, name: member.name || member.email, type: 'dm',
          other_member: member, last_message: null, unread_count: 0,
          member_count: 2, created_at: new Date().toISOString(),
        })
      }
      setView('chat')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create conversation')
    }
  }

  const filteredMembers = orgMembers.filter((m: any) => {
    if (!memberSearch.trim()) return true
    const q = memberSearch.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  // ─── Conversations List ──────────────────────────────────

  const renderConversation = ({ item }: { item: ChatChannel }) => {
    const color = getAvatarColor(item.id)
    const lastMsg = item.last_message
    const preview = lastMsg ? `${lastMsg.sender_name.split(' ')[0]}: ${lastMsg.content}` : 'No messages yet'
    const time = lastMsg ? formatListTime(lastMsg.created_at) : ''
    const hasUnread = item.unread_count > 0

    return (
      <Pressable
        onPress={() => openChannel(item)}
        style={({ pressed }) => [listStyles.row, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}
      >
        <View style={[listStyles.avatar, { backgroundColor: color }]}>
          <Text style={listStyles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={listStyles.rowContent}>
          <View style={listStyles.rowTop}>
            <Text style={[listStyles.name, { color: c.ink, fontWeight: hasUnread ? '700' : '500' }]} numberOfLines={1}>{item.name}</Text>
            {time ? <Text style={[listStyles.time, { color: hasUnread ? c.primary : c.muted }]}>{time}</Text> : null}
          </View>
          <View style={listStyles.rowBottom}>
            <Text style={[listStyles.preview, { color: hasUnread ? c.ink : c.muted, fontWeight: hasUnread ? '500' : '400' }]} numberOfLines={1}>{preview}</Text>
            {hasUnread && (
              <View style={[listStyles.badge, { backgroundColor: c.primary }]}>
                <Text style={listStyles.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    )
  }

  // ─── Message Bubble ──────────────────────────────────────

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
        <View style={msgStyles.bubbleWrap}>
          {!isMe && (
            <Text style={[msgStyles.senderName, { color: avatarColor }]}>{item.sender_name}</Text>
          )}
          <View style={[
            msgStyles.bubble,
            isMe ? [msgStyles.bubbleMe, { backgroundColor: c.primary }] : [msgStyles.bubbleOther, { backgroundColor: c.surface, borderColor: c.borderLight }]
          ]}>
            <Text style={[msgStyles.text, { color: isMe ? '#FFFFFF' : c.ink }]}>{item.message}</Text>
          </View>
          <View style={[msgStyles.footer, isMe && msgStyles.footerMe]}>
            <Text style={[msgStyles.time, { color: c.muted }]}>{formatMsgTime(item.created_at)}</Text>
            {item.edited && <Text style={[msgStyles.edited, { color: c.muted }]}>edited</Text>}
            {isMe && <Ionicons name="checkmark-done" size={14} color={c.primary} />}
          </View>
        </View>
      </Pressable>
    )
  }

  // ─── List View ───────────────────────────────────────────

  if (view === 'list') {
    return (
      <SafeAreaView style={[listStyles.container, dyn(c).screen]} edges={['top']}>
        <View style={[listStyles.header, { backgroundColor: c.bg }]}>
          {onBack ? (
            <Pressable onPress={onBack} style={listStyles.headerBtn}>
              <Ionicons name="arrow-back" size={22} color={c.primary} />
            </Pressable>
          ) : <View style={{ width: 44 }} />}
          <Text style={[listStyles.headerTitle, { color: c.ink }]}>Messages</Text>
          <Pressable onPress={openNewChat} style={listStyles.headerBtn}>
            <View style={[listStyles.composeBtn, { backgroundColor: c.primary }]}>
              <Ionicons name="pencil" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {loading ? (
          <View style={listStyles.centered}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        ) : (
          <FlatList
            data={channels}
            keyExtractor={item => item.id}
            renderItem={renderConversation}
            contentContainerStyle={{ paddingTop: spacing.xs }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="transparent" />}
            ItemSeparatorComponent={() => <View style={[listStyles.separator, { backgroundColor: c.borderLight }]} />}
            ListEmptyComponent={
              <View style={listStyles.centered}>
                <View style={[listStyles.emptyIconCircle, { backgroundColor: c.primarySurface }]}>
                  <Ionicons name="chatbubbles" size={32} color={c.primary} />
                </View>
                <Text style={[listStyles.emptyTitle, { color: c.ink }]}>No conversations yet</Text>
                <Text style={[listStyles.emptySub, { color: c.muted }]}>Tap the compose button to start chatting</Text>
              </View>
            }
          />
        )}

        {/* New Chat Modal */}
        <Modal visible={showNewChat} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={[listStyles.container, { backgroundColor: c.bg }]} edges={['top']}>
            <View style={[listStyles.header, { backgroundColor: c.bg }]}>
              <Pressable onPress={() => { setShowNewChat(false); setMemberSearch('') }} style={listStyles.headerBtn}>
                <Text style={[listStyles.cancelText, { color: c.primary }]}>Cancel</Text>
              </Pressable>
              <Text style={[listStyles.headerTitle, { color: c.ink }]}>New Message</Text>
              <View style={{ width: 80 }} />
            </View>
            <View style={[listStyles.searchWrap, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name="search" size={16} color={c.muted} />
              <TextInput
                style={[listStyles.searchInput, { color: c.ink }]}
                placeholder="Search people..."
                placeholderTextColor={c.muted}
                value={memberSearch}
                onChangeText={setMemberSearch}
                autoFocus
              />
            </View>
            {loadingMembers ? (
              <View style={listStyles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
            ) : (
              <FlatList
                data={filteredMembers}
                keyExtractor={item => item.id}
                ItemSeparatorComponent={() => <View style={[listStyles.separator, { backgroundColor: c.borderLight, marginLeft: 76 }]} />}
                renderItem={({ item: member }) => {
                  const color = getAvatarColor(member.id)
                  return (
                    <Pressable
                      onPress={() => startDM(member)}
                      style={({ pressed }) => [listStyles.row, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}
                    >
                      <View style={[listStyles.avatar, { backgroundColor: color }]}>
                        <Text style={listStyles.avatarText}>{getInitials(member.name || member.email)}</Text>
                      </View>
                      <View style={listStyles.rowContent}>
                        <Text style={[listStyles.name, { color: c.ink }]}>{member.name || member.email}</Text>
                        <Text style={[listStyles.roleText, { color: c.muted }]}>{(member.role || '').replace('_', ' ')}</Text>
                      </View>
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

  // ─── Chat View ───────────────────────────────────────────

  const channelColor = getAvatarColor(activeChannel?.id || '')

  return (
    <SafeAreaView style={[chatStyles.container, dyn(c).screen]} edges={['top']}>
      {/* Header */}
      <View style={[chatStyles.header, { backgroundColor: c.bg, borderBottomColor: c.borderLight }]}>
        <Pressable onPress={backToList} style={chatStyles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
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
        <Pressable style={chatStyles.headerBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={c.muted} />
        </Pressable>
      </View>

      {/* Messages */}
      {loadingMessages ? (
        <View style={chatStyles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
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
        <View style={[chatStyles.inputBar, { backgroundColor: c.bg, borderTopColor: c.borderLight }]}>
          <View style={[chatStyles.inputWrap, { backgroundColor: c.surfaceAlt }]}>
            <TextInput
              style={[chatStyles.input, { color: c.ink }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message..."
              placeholderTextColor={c.muted}
              multiline
              maxLength={5000}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[chatStyles.sendBtn, { backgroundColor: inputText.trim() ? c.primary : c.surfaceAlt }]}
          >
            <Ionicons name="arrow-up" size={22} color={inputText.trim() ? '#FFFFFF' : c.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles: List ─────────────────────────────────────────

const listStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
  },
  headerBtn: { width: 80, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT, letterSpacing: -0.3 },
  cancelText: { fontSize: 16, fontFamily: FONT, fontWeight: '500' },
  composeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.base,
    borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md, gap: spacing.md },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontFamily: FONT },
  name: { fontSize: 16, fontFamily: FONT },
  preview: { fontSize: 14, fontFamily: FONT, flex: 1 },
  roleText: { fontSize: 12, fontFamily: FONT, textTransform: 'capitalize' as const, marginTop: 1 },
  time: { fontSize: 12, fontFamily: FONT },
  badge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: spacing.sm },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', fontFamily: FONT },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center', paddingHorizontal: 40 },
})

// ─── Styles: Chat ─────────────────────────────────────────

const chatStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: FONT },
  headerName: { fontSize: 16, fontWeight: '600', fontFamily: FONT },
  headerSub: { fontSize: 12, fontFamily: FONT, marginTop: 1 },
  messageList: { padding: spacing.base, paddingBottom: spacing.sm, paddingTop: spacing.md },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center' },
  input: { fontSize: 16, fontFamily: FONT, paddingVertical: Platform.OS === 'ios' ? spacing.xs : spacing.sm, maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 100 },
  emptyAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base },
  emptyAvatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', fontFamily: FONT },
  emptyTitle: { fontSize: 18, fontWeight: '600', fontFamily: FONT, marginBottom: spacing.xs },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center' },
})

// ─── Styles: Messages ─────────────────────────────────────

const msgStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginBottom: spacing.sm, maxWidth: '78%' },
  rowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  avatarText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', fontFamily: FONT },
  bubbleWrap: { gap: 3 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%' },
  bubbleMe: { borderRadius: 18, borderBottomLeftRadius: 4, borderBottomRightRadius: 18 },
  bubbleOther: { borderRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  senderName: { fontSize: 12, fontWeight: '600', fontFamily: FONT },
  text: { fontSize: 15, lineHeight: 20, fontFamily: FONT },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerMe: { justifyContent: 'flex-end' },
  time: { fontSize: 11, fontFamily: FONT },
  edited: { fontSize: 11, fontFamily: FONT, fontStyle: 'italic' },
})
