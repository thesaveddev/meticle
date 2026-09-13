import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme'
import type { AuthSession } from '../types'
import { getChatChannels, getChatMessages, sendChatMessage, editChatMessage, deleteChatMessage, markChatRead } from '../services/api'
import { Ionicons } from '@expo/vector-icons'

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

export function ChatScreen({ session, onBack }: Props) {
  const { colors: c } = useTheme()
  const [channels, setChannels] = useState<string[]>(['general'])
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const flatListRef = useRef<FlatList>(null)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

  const token = session?.accessToken || ''
  const currentUserId = session?.user?.id || ''

  const loadChannels = useCallback(async () => {
    if (!token) return
    try {
      const ch = await getChatChannels(token)
      setChannels(ch.length ? ch : ['general'])
    } catch {}
  }, [token])

  const loadMessages = useCallback(async () => {
    if (!token) return
    try {
      const msgs = await getChatMessages(token, activeChannel, 50)
      setMessages(msgs)
      // Mark as read
      markChatRead(token, activeChannel).catch(() => {})
    } catch {} finally {
      setLoading(false)
    }
  }, [token, activeChannel])

  useEffect(() => { loadChannels() }, [loadChannels])
  useEffect(() => { loadMessages() }, [loadMessages])

  // Poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (token) loadMessages()
    }, 10000)
    return () => clearInterval(interval)
  }, [token, loadMessages])

  const handleSend = async () => {
    if (!inputText.trim() || sending) return
    setSending(true)
    try {
      const msg = await sendChatMessage(token, activeChannel, inputText.trim(), replyTo?.id)
      setMessages(prev => [...prev, msg])
      setInputText('')
      setReplyTo(null)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadMessages()
    setRefreshing(false)
  }

  const handleDelete = (msg: ChatMessage) => {
    if (msg.sender_id !== currentUserId) return
    Alert.alert('Delete message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteChatMessage(token, msg.id)
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, deleted: true, message: '' } : m))
          } catch {}
        }
      }
    ])
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (isToday) return time
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + time
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.deleted) return null
    const isMe = item.sender_id === currentUserId
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
    const colorIdx = item.sender_id.charCodeAt(0) % colors.length
    const avatarColor = colors[colorIdx]

    return (
      <TouchableOpacity
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
        style={[styles.messageRow, isMe && styles.messageRowMe]}
      >
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>  
            <Text style={styles.avatarText}>{getInitials(item.sender_name)}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, { backgroundColor: isMe ? '#6366F1' : c.surface }, isMe && styles.bubbleMe]}>
          {!isMe && <Text style={[styles.senderName, { color: avatarColor }]}>{item.sender_name}</Text>}
          {item.reply_to_id && (
            <View style={[styles.replyBadge, { backgroundColor: (isMe ? '#ffffff20' : c.border) }]}>  
              <Text style={[styles.replyText, { color: isMe ? '#ffffffcc' : c.muted }]}>Replying to a message</Text>
            </View>
          )}
          <Text style={[styles.messageText, { color: isMe ? '#FFFFFF' : c.ink }]}>{item.message}</Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, { color: isMe ? '#ffffffaa' : c.muted }]}>{formatTime(item.created_at)}</Text>
            {item.edited && <Text style={[styles.editedText, { color: isMe ? '#ffffffaa' : c.muted }]}>edited</Text>}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]} edges={['top']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>  
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={c.ink} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
        <Text style={[styles.headerTitle, { color: c.ink }]}>Team Chat</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Channel tabs */}
      <View style={[styles.channelBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>  
        <FlatList
          horizontal
          data={channels}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.channelList}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => { setActiveChannel(item); setLoading(true) }}
              style={[styles.channelPill, { backgroundColor: activeChannel === item ? '#6366F1' : c.border }]}
            >
              <Text style={[styles.channelPillText, { color: activeChannel === item ? '#FFFFFF' : c.ink }]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={{ color: c.muted }}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages.filter(m => !m.deleted)}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="transparent" />}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="chatbubbles-outline" size={48} color={c.border} />
              <Text style={[styles.emptyText, { color: c.muted }]}>No messages yet</Text>
              <Text style={[styles.emptySubtext, { color: c.muted }]}>Start the conversation in #{activeChannel}</Text>
            </View>
          }
        />
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: c.surface, borderTopColor: c.border }]}>  
          <View style={{ flex: 1 }}>
            <Text style={[styles.replyPreviewName, { color: '#6366F1' }]}>{replyTo.sender_name}</Text>
            <Text style={[styles.replyPreviewText, { color: c.muted }]} numberOfLines={1}>{replyTo.message}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close-circle" size={20} color={c.muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>  
        <TextInput
          style={[styles.textInput, { backgroundColor: c.bg, color: c.ink, borderColor: c.border }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message #${activeChannel}`}
          placeholderTextColor={c.muted}
          multiline
          maxLength={5000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: inputText.trim() ? '#6366F1' : c.border }]}
        >
          <Ionicons name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-SemiBold' },
  channelBar: { borderBottomWidth: 1, paddingVertical: 8 },
  channelList: { paddingHorizontal: 12, gap: 8 },
  channelPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  channelPillText: { fontSize: 13, fontFamily: 'Inter-Medium' },
  messageList: { padding: 16, paddingBottom: 8, gap: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%' },
  messageRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-Bold' },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomLeftRadius: 4 },
  bubbleMe: { borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  senderName: { fontSize: 12, fontFamily: 'Inter-SemiBold', marginBottom: 2 },
  messageText: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter-Regular' },
  messageFooter: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' },
  timeText: { fontSize: 11, fontFamily: 'Inter-Regular' },
  editedText: { fontSize: 11, fontFamily: 'Inter-Regular', fontStyle: 'italic' },
  replyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  replyText: { fontSize: 11, fontFamily: 'Inter-Regular' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, gap: 8 },
  textInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter-Regular', maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 16, fontFamily: 'Inter-Medium' },
  emptySubtext: { fontSize: 13, fontFamily: 'Inter-Regular' },
  replyPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, gap: 8 },
  replyPreviewName: { fontSize: 12, fontFamily: 'Inter-SemiBold' },
  replyPreviewText: { fontSize: 13, fontFamily: 'Inter-Regular' },
})
