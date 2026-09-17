import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform,
  RefreshControl, Alert, Pressable, Modal, ActivityIndicator, Image,
  Dimensions, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Sharing from 'expo-sharing'
import { connectChatSocket } from '../services/chatSocket'
import { elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import {
  ensureGeneralChannel, getChatChannels, getChatMessages, sendChatMessage,
  deleteChatMessage, markChatRead, markChatDelivered, getChatReadReceipts, getOrgMembers, getChatChannelMembers,
  createDMChannel, uploadChatFile, downloadChatFile,
} from '../services/api'
import { hapticLight } from '../services/haptics'

const EMOJIS = [
  '\u{1F600}','\u{1F603}','\u{1F604}','\u{1F601}','\u{1F605}','\u{1F602}','\u{1F923}','\u{1F60A}',
  '\u{1F607}','\u{1F642}','\u{1F643}','\u{1F609}','\u{1F60C}','\u{1F60D}','\u{1F970}','\u{1F618}',
  '\u{1F617}','\u{1F60B}','\u{1F61B}','\u{1F61C}','\u{1F92A}','\u{1F61D}','\u{1F911}','\u{1F917}',
  '\u{1F92D}','\u{1F92B}','\u{1F914}','\u{1F910}','\u{1F928}','\u{1F610}','\u{1F611}','\u{1F636}',
  '\u{1F60F}','\u{1F612}','\u{1F644}','\u{1F62C}','\u{1F614}','\u{1F62A}','\u{1F924}','\u{1F634}',
  '\u{1F637}','\u{1F912}','\u{1F915}','\u{1F922}','\u{1F92E}','\u{1F974}','\u{1F635}','\u{1F92F}',
  '\u{1F973}','\u{1F60E}','\u{1F615}','\u{1F61F}','\u{1F61E}','\u{1F61A}','\u{1F623}','\u{1F624}',
  '\u{1F620}','\u{1F621}','\u{1F92C}','\u{1F44B}','\u{1F44C}','\u{1F90F}','\u{1F91E}','\u{1F91F}',
  '\u{1F918}','\u{1F44D}','\u{1F44E}','\u{1F44A}','\u{1F44C}','\u{1F91A}','\u{1F91B}','\u{1F44F}',
  '\u{1F64C}','\u{1F932}','\u{1F91D}','\u{1F4AA}','\u{2764}\u{FE0F}','\u{1F9E1}','\u{1F49B}',
  '\u{1F49A}','\u{1F499}','\u{1F5A4}','\u{1F90D}','\u{1F90E}','\u{1F494}','\u{1F525}','\u{2B50}',
  '\u{1F31F}','\u{2728}','\u{1F4AF}','\u{2705}','\u{274C}','\u{2757}','\u{2753}','\u{1F4AC}',
  '\u{1F4C1}','\u{1F4C2}','\u{1F4CE}','\u{1F517}','\u{1F389}','\u{1F38A}','\u{1F388}','\u{1F680}',
  '\u{1F4CC}','\u{1F3AF}',
]

const SCREEN_WIDTH = Dimensions.get('window').width
const EMOJI_COLUMNS = 8

interface ChatChannel {
  id: string
  name: string
  channel_type: 'general' | 'group' | 'dm'
  other_member?: { id: string; name: string; email: string; profile_picture_url?: string } | null
  last_message?: { content: string; sender_name: string; created_at: string } | null
  unread_count: number
  member_count: number
  created_at: string | null
}

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_email: string
  channel: string
  message: string
  file_url?: string
  file_name?: string
  reply_to_id?: string
  edited: boolean
  deleted: boolean
  created_at: string
  delivered_at?: string | null
}

interface PreviewImage {
  messageId: string
  url: string
  name: string
}

interface Props {
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
  if (!name) return '?'
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
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null)
  const [memberReads, setMemberReads] = useState<any[]>([])
  const [imageUris, setImageUris] = useState<Record<string, string>>({})
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)

  const [showNewChat, setShowNewChat] = useState(false)
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [showChannelMembers, setShowChannelMembers] = useState(false)
  const [channelMembers, setChannelMembers] = useState<any[]>([])
  const [channelMemberSearch, setChannelMemberSearch] = useState('')
  const [loadingChannelMembers, setLoadingChannelMembers] = useState(false)

  const [showContact, setShowContact] = useState(false)
  const [contactInfo, setContactInfo] = useState<{ name: string; email: string; role?: string } | null>(null)

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; message: ChatMessage | null }>({ visible: false, message: null })

  // Emoji picker
  const [showEmoji, setShowEmoji] = useState(false)

  // Image upload
  const [pendingImage, setPendingImage] = useState<{ uri: string; name: string } | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const flatListRef = useRef<FlatList>(null)

  const loadChannels = useCallback(async () => {
    if (!token) return
    try {
      await ensureGeneralChannel(token).catch(() => {})
      const data = await getChatChannels(token)
      if (Array.isArray(data)) setChannels(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadChannels() }, [loadChannels])
  useEffect(() => {
    const interval = setInterval(loadChannels, 15000)
    return () => clearInterval(interval)
  }, [loadChannels])

  const loadMessages = useCallback(async () => {
    if (!token || !activeChannel) return
    try {
      const result = await getChatMessages(token, activeChannel.id, 80)
      const msgs = Array.isArray(result) ? result : result?.messages
      if (Array.isArray(msgs)) {
        setMessages(msgs)
        const incomingIds = msgs.filter((m: ChatMessage) => m.sender_id !== currentUserId).map((m: ChatMessage) => m.id)
        if (incomingIds.length > 0) await markChatDelivered(token, activeChannel.id, incomingIds).catch(() => {})
      }
      if (!Array.isArray(result)) {
        setOtherLastRead(result?.other_last_read_at || null)
        setMemberReads(result?.member_reads || [])
      } else {
        const receipts = await getChatReadReceipts(token, activeChannel.id).catch(() => null)
        setOtherLastRead(receipts?.other_last_read_at || null)
        setMemberReads(receipts?.member_reads || [])
      }
      await markChatRead(token, activeChannel.id).catch(() => {})
      setChannels(prev => prev.map(channel => channel.id === activeChannel.id ? { ...channel, unread_count: 0 } : channel))
      void loadChannels()
    } catch { /* ignore */ } finally { setLoadingMessages(false) }
  }, [token, activeChannel, currentUserId, loadChannels])

  useEffect(() => {
    if (activeChannel) {
      setLoadingMessages(true)
      setImageUris({})
      setImageErrors({})
      setPreviewImage(null)
      loadMessages()
    }
  }, [activeChannel, loadMessages])

  // Private chat files require authentication, which is unreliable as a direct
  // Image URI on some Android builds. Download them into the app cache first so
  // thumbnails and full-screen previews use a stable local URI.
  useEffect(() => {
    if (!token) return
    const attachments = messages.filter(message => Boolean(message.file_url && !imageUris[message.id] && !imageErrors[message.id]))
    if (!attachments.length) return
    let cancelled = false
    attachments.forEach(message => {
      void downloadChatFile(token, message.file_url!, message.file_name || 'chat-image')
        .then(file => {
          if (!cancelled) setImageUris(prev => ({ ...prev, [message.id]: file.uri }))
        })
        .catch(() => {
          if (!cancelled) setImageErrors(prev => ({ ...prev, [message.id]: true }))
        })
    })
    return () => { cancelled = true }
  }, [messages, token, imageUris, imageErrors])

  useEffect(() => {
    if (view !== 'chat' || !activeChannel || !token) return
    const socket = connectChatSocket(token)
    const join = () => socket.emit('chat:join', activeChannel.id)
    const onMessage = (incoming: ChatMessage & { channel_id?: string }) => {
      if (incoming.channel_id !== activeChannel.id && incoming.channel !== activeChannel.id) return
      setMessages(prev => prev.some(message => message.id === incoming.id) ? prev : [...prev, incoming])
      if (incoming.sender_id !== currentUserId) {
        void markChatDelivered(token, activeChannel.id, [incoming.id]).catch(() => {})
        void markChatRead(token, activeChannel.id).catch(() => {})
      }
    }
    const onDelivered = (data: { channelId: string; messageIds?: string[]; deliveredAt?: string }) => {
      if (data.channelId !== activeChannel.id || !data.messageIds?.length) return
      setMessages(prev => prev.map(message => data.messageIds!.includes(message.id) ? { ...message, delivered_at: message.delivered_at || data.deliveredAt || new Date().toISOString() } : message))
    }
    const onRead = (data: { channelId: string; userId: string; lastReadAt?: string }) => {
      if (data.channelId === activeChannel.id && data.userId !== currentUserId && data.lastReadAt) setOtherLastRead(data.lastReadAt)
    }
    socket.on('connect', join)
    socket.on('chat:message', onMessage)
    socket.on('chat:delivered', onDelivered)
    socket.on('chat:read', onRead)
    if (socket.connected) join()
    const interval = setInterval(loadMessages, 15000)
    return () => {
      clearInterval(interval)
      socket.emit('chat:leave', activeChannel.id)
      socket.off('connect', join)
      socket.off('chat:message', onMessage)
      socket.off('chat:delivered', onDelivered)
      socket.off('chat:read', onRead)
      socket.disconnect()
    }
  }, [view, activeChannel, token, currentUserId, loadMessages])

  const openChannel = (ch: ChatChannel) => {
    hapticLight()
    setChannels(prev => prev.map(channel => channel.id === ch.id ? { ...channel, unread_count: 0 } : channel))
    setActiveChannel(ch)
    setView('chat')
    setShowEmoji(false)
    setPendingImage(null)
  }

  const backToList = () => {
    hapticLight()
    setView('list')
    setActiveChannel(null)
    setMessages([])
    setShowEmoji(false)
    setPendingImage(null)
    loadChannels()
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if ((!text && !pendingImage) || sending || !activeChannel) return
    setSending(true)
    setInputText('')
    setShowEmoji(false)

    try {
      let fileUrl: string | undefined
      let fileName: string | undefined

      if (pendingImage) {
        setUploadingImage(true)
        const result = await uploadChatFile(token, pendingImage.uri, pendingImage.name)
        fileUrl = result.url
        fileName = pendingImage.name
        setPendingImage(null)
        setUploadingImage(false)
      }

      const msg = await sendChatMessage(token, activeChannel.id, text || (fileName ? `Shared ${fileName}` : ''), undefined, fileUrl, fileName)
      setMessages(prev => [...prev, msg])
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e: any) {
      setInputText(text)
      setPendingImage(null)
      setUploadingImage(false)
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
        } catch { /* ignore */ }
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
    } catch { /* ignore */ } finally { setLoadingMembers(false) }
  }

  const openChannelMembers = async () => {
    if (!activeChannel) return
    hapticLight()
    setShowChannelMembers(true)
    setChannelMemberSearch('')
    setLoadingChannelMembers(true)
    try {
      const members = await getChatChannelMembers(token, activeChannel.id)
      if (Array.isArray(members)) setChannelMembers(members)
    } catch (e: any) {
      Alert.alert('Could not load members', e.message || 'Please try again')
    } finally { setLoadingChannelMembers(false) }
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
          id: ch.id, name: member.name || member.email, channel_type: 'dm',
          other_member: member, last_message: null, unread_count: 0,
          member_count: 2, created_at: new Date().toISOString(),
        })
      }
      setView('chat')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create conversation')
    }
  }

  const showContactDetails = (name: string, email: string, role?: string) => {
    setContactInfo({ name, email, role })
    setShowContact(true)
  }

  const filteredMembers = orgMembers.filter((m: any) => {
    if (!memberSearch.trim()) return true
    const q = memberSearch.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
  })

  const filteredChannelMembers = channelMembers.filter((m: any) => {
    if (!channelMemberSearch.trim()) return true
    const q = channelMemberSearch.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.role || '').toLowerCase().includes(q)
  })

  // ─── Image Picker ───────────────────────────────────────

  const pickImage = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission required', `Please allow ${useCamera ? 'camera' : 'photo library'} access to ${useCamera ? 'take' : 'select'} images.`)
        return
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        const name = asset.fileName || `photo_${Date.now()}.jpg`
        setPendingImage({ uri: asset.uri, name })
        setShowEmoji(false)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pick image')
    }
  }

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
            {hasUnread ? (
              <View style={[listStyles.badge, { backgroundColor: c.primary }]}>
                <Text style={listStyles.badgeText}>{item.unread_count > 99 ? '99+' : String(item.unread_count)}</Text>
              </View>
            ) : null}
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
    const seen = isMe && ((activeChannel?.channel_type === 'dm' && otherLastRead && new Date(item.created_at) <= new Date(otherLastRead)) || (activeChannel?.channel_type !== 'dm' && memberReads.some(r => r.last_read_at && new Date(item.created_at) <= new Date(r.last_read_at))))
    const delivered = isMe && (Boolean(item.delivered_at) || Boolean(seen))

    return (
      <Pressable
        onLongPress={() => {
          hapticLight()
          setContextMenu({ visible: true, message: item })
        }}
        style={[msgStyles.row, isMe && msgStyles.rowMe]}
      >
        {!isMe ? (
          <View style={[msgStyles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={msgStyles.avatarText}>{getInitials(item.sender_name)}</Text>
          </View>
        ) : null}
        <View style={msgStyles.bubbleWrap}>
          {!isMe ? (
            <Text style={[msgStyles.senderName, { color: avatarColor }]}>{item.sender_name}</Text>
          ) : null}
          {item.file_url ? (              <Pressable onPress={() => setPreviewImage({ messageId: item.id, url: item.file_url!, name: item.file_name || 'Chat image' })} accessibilityRole="button" accessibilityLabel={`Preview ${item.file_name || 'image'}`}>
                <View style={[msgStyles.imageFrame, isMe ? msgStyles.imageMe : msgStyles.imageOther, { backgroundColor: isMe ? c.primarySurface : c.surfaceAlt }]}>
                  {imageUris[item.id] ? (
                    <Image
                      source={{ uri: imageUris[item.id] }}
                      style={msgStyles.image}
                      resizeMode="cover"
                    />
                  ) : imageErrors[item.id] ? (
                    <View style={msgStyles.imageState}>
                      <Ionicons name="image-outline" size={28} color={c.muted} />
                      <Text style={[msgStyles.imageStateText, { color: c.muted }]}>Image unavailable</Text>
                    </View>
                  ) : (
                    <View style={msgStyles.imageState}>
                      <ActivityIndicator size="small" color={c.primary} />
                      <Text style={[msgStyles.imageStateText, { color: c.muted }]}>Loading image…</Text>
                    </View>
                  )}
                </View>
                {item.file_name ? (

                <View style={[msgStyles.fileLabel, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : c.surfaceAlt }]}>
                  <Ionicons name="document-text-outline" size={14} color={isMe ? '#FFFFFF' : c.muted} />
                  <Text style={[msgStyles.fileLabelText, { color: isMe ? '#FFFFFF' : c.ink }]} numberOfLines={1}>{item.file_name}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {typeof item.message === 'string' && item.message.length > 0 && item.message !== `Shared ${item.file_name}` ? (
            <View style={[
              msgStyles.bubble,
              isMe ? [msgStyles.bubbleMe, { backgroundColor: c.primary }] : [msgStyles.bubbleOther, { backgroundColor: c.surface, borderColor: c.borderLight }]
            ]}>
              <Text style={[msgStyles.text, { color: isMe ? '#FFFFFF' : c.ink }]}>{item.message}</Text>
            </View>
          ) : null}
          <View style={[msgStyles.footer, isMe && msgStyles.footerMe]}>
            <Text style={[msgStyles.time, { color: c.muted }]}>{formatMsgTime(item.created_at)}</Text>
            {item.edited ? <Text style={[msgStyles.edited, { color: c.muted }]}>edited</Text> : null}
            {isMe ?            <Ionicons name={seen || delivered ? 'checkmark-done' : 'checkmark'} size={14} color={seen ? c.primary : c.muted} /> : null}
          </View>
        </View>
      </Pressable>
    )
  }

  // ─── Modals ─────────────────────────────────────────────

  const downloadPreviewImage = async () => {
    if (!previewImage) return
    try {
      const file = await downloadChatFile(token, previewImage.url, previewImage.name)
      setImageUris(prev => ({ ...prev, [previewImage.messageId]: file.uri }))
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Downloaded', 'The image was downloaded to the app cache.')
        return
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'image/*', dialogTitle: 'Save or share image' })
    } catch (e: any) {
      Alert.alert('Download failed', e.message || 'Could not download this image')
    }
  }

  const renderImagePreview = () => (
    <Modal visible={Boolean(previewImage)} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setPreviewImage(null)}>
      <SafeAreaView style={[previewStyles.container, { backgroundColor: '#000000' }]}>
        <View style={previewStyles.header}>
          <Pressable onPress={() => setPreviewImage(null)} accessibilityRole="button" accessibilityLabel="Close image preview">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={previewStyles.title} numberOfLines={1}>{previewImage?.name || 'Image'}</Text>
          <Pressable onPress={downloadPreviewImage} accessibilityRole="button" accessibilityLabel="Download image">
            <Ionicons name="download-outline" size={25} color="#FFFFFF" />
          </Pressable>
        </View>
        {previewImage ? (
          imageUris[previewImage.messageId] ? (
            <Image source={{ uri: imageUris[previewImage.messageId] }} style={previewStyles.image} resizeMode="contain" />
          ) : imageErrors[previewImage.messageId] ? (
            <View style={previewStyles.emptyState}>
              <Ionicons name="image-outline" size={48} color="#9CA3AF" />
              <Text style={previewStyles.emptyTitle}>Image unavailable</Text>
              <Text style={previewStyles.emptySub}>This image could not be loaded. Try downloading it again.</Text>
              <Pressable onPress={downloadPreviewImage} style={[previewStyles.retryButton, { backgroundColor: c.primary }]}>
                <Text style={previewStyles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={previewStyles.emptyState}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={previewStyles.emptyTitle}>Preparing image preview…</Text>
            </View>
          )
        ) : null}
        <Pressable onPress={downloadPreviewImage} style={[previewStyles.downloadButton, { backgroundColor: c.primary }]} accessibilityRole="button" accessibilityLabel="Save or share image">
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={previewStyles.downloadText}>Save or share image</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  )

  const renderContactModal = () => (
    <Modal visible={showContact} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[listStyles.container, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={[listStyles.header, { backgroundColor: c.bg }]}>
          <Pressable onPress={() => setShowContact(false)} style={listStyles.headerBtn}>
            <Text style={[listStyles.cancelText, { color: c.primary }]}>Close</Text>
          </Pressable>
          <Text style={[listStyles.headerTitle, { color: c.ink }]}>Contact</Text>
          <View style={{ width: 80 }} />
        </View>
        {contactInfo ? (
          <View style={{ padding: spacing.base, alignItems: 'center', gap: spacing.lg }}>
            <View style={[contactStyles.avatar, { backgroundColor: getAvatarColor(contactInfo.email) }]}>
              <Text style={contactStyles.avatarText}>{getInitials(contactInfo.name)}</Text>
            </View>
            <Text style={[contactStyles.name, { color: c.ink }]}>{contactInfo.name}</Text>
            {contactInfo.role ? <Text style={[contactStyles.role, { color: c.muted }]}>{contactInfo.role.replace('_', ' ')}</Text> : null}
            <View style={[contactStyles.infoCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={contactStyles.infoRow}>
                <Ionicons name="mail-outline" size={18} color={c.muted} />
                <Text style={[contactStyles.infoText, { color: c.ink }]}>{contactInfo.email}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowContact(false)}
              style={[contactStyles.messageBtn, { backgroundColor: c.primary }]}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
              <Text style={contactStyles.messageBtnText}>Send message</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  )

  const renderChannelMembers = () => (
    <Modal visible={showChannelMembers} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[listStyles.container, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={[listStyles.header, { backgroundColor: c.bg }]}>
          <Pressable onPress={() => setShowChannelMembers(false)} style={listStyles.headerBtn}>
            <Text style={[listStyles.cancelText, { color: c.primary }]}>Close</Text>
          </Pressable>
          <Text style={[listStyles.headerTitle, { color: c.ink }]} numberOfLines={1}>{activeChannel?.name || 'Group'} members</Text>
          <Text style={[memberDirectoryStyles.count, { color: c.muted }]}>{channelMembers.length}</Text>
        </View>
        <View style={[listStyles.searchWrap, { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1 }]}>
          <Ionicons name="search" size={16} color={c.muted} />
          <TextInput
            style={[listStyles.searchInput, { color: c.ink }]}
            placeholder="Search members..."
            placeholderTextColor={c.muted}
            value={channelMemberSearch}
            onChangeText={setChannelMemberSearch}
            autoFocus
          />
        </View>
        {loadingChannelMembers ? (
          <View style={listStyles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : (
          <FlatList
            data={filteredChannelMembers}
            keyExtractor={item => item.id}
            ItemSeparatorComponent={() => <View style={[listStyles.separator, { backgroundColor: c.borderLight, marginLeft: 76 }]} />}
            ListEmptyComponent={<View style={listStyles.centered}><Text style={[listStyles.emptySub, { color: c.muted }]}>No members found</Text></View>}
            renderItem={({ item: member }) => {
              const name = member.name || member.email || 'Unknown member'
              const isCurrentUser = member.id === currentUserId
              return (
                <Pressable
                  onPress={() => { if (!isCurrentUser) { setShowChannelMembers(false); startDM(member) } }}
                  style={({ pressed }) => [listStyles.row, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}
                  accessibilityRole={isCurrentUser ? undefined : 'button'}
                  accessibilityLabel={isCurrentUser ? `${name}, you` : `Message ${name}`}
                >
                  <View style={[listStyles.avatar, { backgroundColor: getAvatarColor(member.id) }]}>
                    <Text style={listStyles.avatarText}>{getInitials(name)}</Text>
                  </View>
                  <View style={listStyles.rowContent}>
                    <Text style={[listStyles.name, { color: c.ink }]}>{name}{isCurrentUser ? ' (You)' : ''}</Text>
                    <Text style={[listStyles.roleText, { color: c.muted }]}>{member.role ? member.role.replace(/_/g, ' ') : member.email}</Text>
                  </View>
                  {!isCurrentUser ? <Ionicons name="chatbubble-outline" size={19} color={c.primary} /> : null}
                </Pressable>
              )
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  )

  const renderContextMenu = () => (
    <Modal visible={contextMenu.visible} transparent animationType="fade">
      <Pressable style={ctxStyles.overlay} onPress={() => setContextMenu({ visible: false, message: null })}>
        <View style={[ctxStyles.menu, { backgroundColor: c.surface, borderColor: c.border }]}>
          {contextMenu.message && contextMenu.message.sender_id === currentUserId ? (
            <Pressable style={ctxStyles.item} onPress={() => {
              handleDelete(contextMenu.message!)
              setContextMenu({ visible: false, message: null })
            }}>
              <Ionicons name="trash-outline" size={20} color={c.danger} />
              <Text style={[ctxStyles.itemText, { color: c.danger }]}>Delete message</Text>
            </Pressable>
          ) : (
            <Pressable style={ctxStyles.item} onPress={() => {
              if (contextMenu.message) showContactDetails(contextMenu.message.sender_name, contextMenu.message.sender_email)
              setContextMenu({ visible: false, message: null })
            }}>
              <Ionicons name="person-outline" size={20} color={c.primary} />
              <Text style={[ctxStyles.itemText, { color: c.ink }]}>View contact</Text>
            </Pressable>
          )}
          <Pressable style={ctxStyles.item} onPress={() => setContextMenu({ visible: false, message: null })}>
            <Text style={[ctxStyles.itemText, { color: c.muted }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )

  // ─── Emoji Picker Panel ──────────────────────────────────

  const renderEmojiPicker = () => {
    if (!showEmoji) return null
    return (
      <View style={[emojiStyles.container, { backgroundColor: c.surface, borderTopColor: c.borderLight }]}>
        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
          <View style={emojiStyles.grid}>
            {EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => { hapticLight(); setInputText(prev => prev + emoji) }}
                style={emojiStyles.cell}
              >
                <Text style={emojiStyles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    )
  }

  // ─── List View ───────────────────────────────────────────

  if (view === 'list') {
    return (
      <View style={[listStyles.container, dyn(c).screen]}>
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

        <Modal visible={showNewChat} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={[listStyles.container, { backgroundColor: c.bg }]} edges={['top']}>
            <View style={[listStyles.header, { backgroundColor: c.bg }]}>
              <Pressable onPress={() => { setShowNewChat(false); setMemberSearch('') }} style={listStyles.headerBtn}>
                <Text style={[listStyles.cancelText, { color: c.primary }]}>Cancel</Text>
              </Pressable>
              <Text style={[listStyles.headerTitle, { color: c.ink }]}>New Message</Text>
              <View style={{ width: 80 }} />
            </View>
            <View style={[listStyles.searchWrap, { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1 }]}>
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

        {renderContactModal()}
        {renderContextMenu()}
        {renderChannelMembers()}
      </View>
    )
  }

  // ─── Chat View ───────────────────────────────────────────

  const channelColor = getAvatarColor(activeChannel?.id || '')
  const channelMember = activeChannel?.other_member
  const canSend = inputText.trim() || pendingImage

  return (
    <KeyboardAvoidingView
      style={[chatStyles.container, dyn(c).screen]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={[chatStyles.header, { backgroundColor: c.bg, borderBottomColor: c.borderLight }]}>
        <Pressable onPress={backToList} style={chatStyles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
        </Pressable>
        <Pressable
          style={chatStyles.headerInfo}
          onPress={() => {
            if (channelMember) showContactDetails(channelMember.name, channelMember.email)
            else if (activeChannel) openChannelMembers()
          }}
        >
          <View style={[chatStyles.headerAvatar, { backgroundColor: channelColor }]}>
            <Text style={chatStyles.headerAvatarText}>{getInitials(activeChannel?.name || '')}</Text>
          </View>
          <View>
            <Text style={[chatStyles.headerName, { color: c.ink }]} numberOfLines={1}>{activeChannel?.name}</Text>
            <Text style={[chatStyles.headerSub, { color: c.muted }]}>
              {activeChannel?.channel_type === 'dm' ? (channelMember?.email || 'Online') : `${activeChannel?.member_count ?? channelMembers.length} members`}
            </Text>
          </View>
        </Pressable>
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

      {/* Pending image preview */}
      {pendingImage ? (
        <View style={[chatStyles.pendingImageWrap, { backgroundColor: c.surfaceAlt, borderTopColor: c.borderLight }]}>
          <Image source={{ uri: pendingImage.uri }} style={chatStyles.pendingImage} resizeMode="cover" />
          <View style={chatStyles.pendingImageInfo}>
            <Text style={[chatStyles.pendingImageName, { color: c.ink }]} numberOfLines={1}>{pendingImage.name}</Text>
            <Text style={[chatStyles.pendingImageSize, { color: c.muted }]}>Ready to send</Text>
          </View>
          <Pressable onPress={() => setPendingImage(null)} style={chatStyles.pendingImageRemove}>
            <Ionicons name="close-circle" size={22} color={c.muted} />
          </Pressable>
        </View>
      ) : null}

      {/* Emoji picker */}
      {renderEmojiPicker()}

      {/* Input bar */}
      <View style={[chatStyles.inputBar, { backgroundColor: c.bg, borderTopColor: c.borderLight }]}>
        {/* Image pick buttons */}
        <Pressable
          onPress={() => {
            Alert.alert('Add image', 'Choose a source', [
              { text: 'Camera', onPress: () => pickImage(true) },
              { text: 'Gallery', onPress: () => pickImage(false) },
              { text: 'Cancel', style: 'cancel' },
            ])
          }}
          style={chatStyles.actionBtn}
        >
          <Ionicons name="camera-outline" size={24} color={c.muted} />
        </Pressable>

        {/* Emoji toggle */}
        <Pressable
          onPress={() => { hapticLight(); setShowEmoji(!showEmoji) }}
          style={chatStyles.actionBtn}
        >
          <Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={24} color={showEmoji ? c.primary : c.muted} />
        </Pressable>

        {/* Text input */}
        <View style={[chatStyles.inputWrap, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}>
          <TextInput
            style={[chatStyles.input, { color: c.ink }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={c.subtle}
            multiline
            maxLength={5000}
          />
        </View>

        {/* Send button */}
        <Pressable
          onPress={handleSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!canSend || sending || uploadingImage}
          style={[chatStyles.sendBtn, { backgroundColor: canSend ? c.primary : c.surfaceAlt }]}
        >
          {sending || uploadingImage ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={22} color={canSend ? '#FFFFFF' : c.muted} />
          )}
        </Pressable>
      </View>

      {renderContactModal()}
      {renderContextMenu()}
      {renderChannelMembers()}
      {renderImagePreview()}
    </KeyboardAvoidingView>
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
  roleText: { fontSize: 12, fontFamily: FONT, textTransform: 'capitalize', marginTop: 1 },
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
    paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs,
  },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center' },
  input: { fontSize: 16, fontFamily: FONT, paddingVertical: Platform.OS === 'ios' ? spacing.xs : spacing.sm, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 100 },
  emptyAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base },
  emptyAvatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', fontFamily: FONT },
  emptyTitle: { fontSize: 18, fontWeight: '600', fontFamily: FONT, marginBottom: spacing.xs },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center' },
  pendingImageWrap: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  pendingImage: { width: 48, height: 48, borderRadius: radii.sm },
  pendingImageInfo: { flex: 1 },
  pendingImageName: { fontSize: 13, fontWeight: '600', fontFamily: FONT },
  pendingImageSize: { fontSize: 11, fontFamily: FONT },
  pendingImageRemove: { padding: 4 },
})

// ─── Styles: Messages ─────────────────────────────────────

const msgStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginBottom: spacing.sm, maxWidth: '80%' },
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
  edited: { fontSize: 11, fontFamily: FONT },
  imageFrame: { width: 220, height: 165, borderRadius: radii.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  imageMe: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  imageOther: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  imageState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageStateText: { fontSize: 12, fontFamily: FONT },
  fileLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  fileLabelText: { fontSize: 12, fontFamily: FONT, flex: 1 },
})

// ─── Styles: Emoji Picker ────────────────────────────────

const emojiStyles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  cell: {
    width: SCREEN_WIDTH / EMOJI_COLUMNS, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
})

// ─── Styles: Contact Details ──────────────────────────────

const memberDirectoryStyles = StyleSheet.create({
  count: { fontSize: 13, fontFamily: FONT, minWidth: 28, textAlign: 'right' },
})

const previewStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontFamily: FONT, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  image: { flex: 1, width: '100%' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: FONT, textAlign: 'center' },
  emptySub: { color: '#9CA3AF', fontSize: 13, fontFamily: FONT, textAlign: 'center', lineHeight: 19 },
  retryButton: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.lg },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', fontFamily: FONT },
  downloadButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.lg, marginVertical: spacing.lg },
  downloadText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontFamily: FONT },
})

const contactStyles = StyleSheet.create({
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', fontFamily: FONT },
  name: { fontSize: 22, fontWeight: '700', fontFamily: FONT, letterSpacing: -0.3 },
  role: { fontSize: 14, fontFamily: FONT, textTransform: 'capitalize' },
  infoCard: { width: '100%', borderRadius: radii.lg, padding: spacing.base, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoText: { fontSize: 15, fontFamily: FONT, flex: 1 },
  messageBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.lg },
  messageBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: FONT },
})

// ─── Styles: Context Menu ─────────────────────────────────

const ctxStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menu: { borderRadius: radii.lg, padding: spacing.sm, minWidth: 200, ...elevation.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.base },
  itemText: { fontSize: 16, fontFamily: FONT, fontWeight: '500' },
})
