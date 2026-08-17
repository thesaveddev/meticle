import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../../services/api'
import { getSocket, onReconnect } from '../../../services/socket'
import { getCurrentUser, URL_REGEX } from '../utils'

export interface ChatChannel {
  id: string
  name: string
  type: 'general' | 'group' | 'dm'
  created_by: string
  organization_id: string
  last_message?: string
  last_message_at?: string
  unread_count?: number
  members?: { user_id: string; first_name?: string; last_name?: string; email?: string; profile_picture_url?: string }[]
}

export interface ChatMessage {
  id: string
  channel_id: string
  sender_id: string
  content?: string
  file_url?: string
  file_name?: string
  file_type?: string
  created_at: string
  edited_at?: string
  first_name?: string
  last_name?: string
  email?: string
  profile_picture_url?: string
  reactions?: { emoji: string; count: number; reacted_by_me: boolean }[]
  parent_id?: string | null
  parent_msg_id?: string | null
  parent_content?: string | null
  parent_file_name?: string | null
  parent_sender_id?: string | null
  parent_created_at?: string | null
  parent_first_name?: string | null
  parent_last_name?: string | null
  parent_email?: string | null
}

export interface OrgMember {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  role?: string
  profile_picture_url?: string
}

export interface ChannelMember {
  user_id: string
  first_name?: string
  last_name?: string
  email?: string
  role?: string
  profile_picture_url?: string
}

export interface SharedFile {
  id: string
  channel_id: string
  file_name: string
  file_url: string
  file_size?: number
  file_type?: string
  created_at: string
  first_name?: string
  last_name?: string
  email?: string
}

export function useChat() {
  const user = getCurrentUser()
  const currentUserId = user.id

  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)

  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([])
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)

  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; name: string }[]>>({})
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null)
  const [memberReads, setMemberReads] = useState<any[]>([])

  const [sendError, setSendError] = useState('')
  const [uploadError, setUploadError] = useState('')

  const [inputLinkPreview, setInputLinkPreview] = useState<{ title: string; description: string; image: string; url: string } | null>(null)
  const [inputLinkLoading, setInputLinkLoading] = useState(false)

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const msgContainerRef = useRef<HTMLDivElement>(null)

  const activeChannelData = channels.find(c => c.id === activeChannel)
  const totalUnread = channels.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  const notifyUnread = useCallback((count: number) => {
    window.dispatchEvent(new CustomEvent('chatUnreadUpdate', { detail: { count } }))
  }, [])

  useEffect(() => { notifyUnread(totalUnread) }, [totalUnread, notifyUnread])

  const loadChannels = useCallback(async () => {
    try {
      await api.post('/chat/ensure-general')
      const res = await api.get('/chat/channels')
      setChannels(res.data)
      if (res.data.length > 0 && !activeChannel) {
        setActiveChannel(res.data[0].id)
      }
    } catch { /* ignore */ }
  }, [activeChannel])

  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId) return
    try {
      setLoading(true)
      const res = await api.get(`/chat/channels/${channelId}/messages`)
      setMessages(res.data.messages || res.data)
      setOtherLastRead(res.data.other_last_read_at || null)
      setMemberReads(res.data.member_reads || [])
      setHasOlder((res.data.messages || res.data).length >= 50)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const loadOlderMessages = useCallback(async (channelId: string) => {
    if (!channelId || olderLoading || messages.length === 0) return
    try {
      setOlderLoading(true)
      const oldest = messages[0]
      const res = await api.get(`/chat/channels/${channelId}/messages`, { params: { before: oldest.created_at, limit: 50 } })
      const older = res.data.messages || res.data
      if (older.length > 0) {
        setMessages(prev => {
          const existing = new Set(prev.map((m: any) => m.id))
          return [...older.filter((m: any) => !existing.has(m.id)), ...prev]
        })
        setHasOlder(older.length >= 50)
      } else {
        setHasOlder(false)
      }
    } catch { /* ignore */ }
    finally { setOlderLoading(false) }
  }, [olderLoading, messages])

  const loadOrgMembers = useCallback(async () => {
    try {
      const res = await api.get('/chat/org-members')
      setOrgMembers(res.data)
    } catch { /* ignore */ }
  }, [])

  const loadChannelMembers = useCallback(async (channelId: string) => {
    try {
      const res = await api.get(`/chat/channels/${channelId}/members`)
      setChannelMembers(res.data)
    } catch { /* ignore */ }
  }, [])

  const loadSharedFiles = useCallback(async (channelId: string) => {
    try {
      setFilesLoading(true)
      const res = await api.get(`/chat/channels/${channelId}/files`)
      setSharedFiles(res.data)
    } catch { /* ignore */ }
    finally { setFilesLoading(false) }
  }, [])

  const markAsRead = useCallback(async (channelId: string) => {
    try { await api.post(`/chat/channels/${channelId}/read`) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadChannels(); loadOrgMembers() }, [loadChannels, loadOrgMembers])

  useEffect(() => {
    setMessageText('')
    setSendError('')
    setInputLinkPreview(null)
    setEditingMessageId(null)
    setReplyTo(null)
  }, [activeChannel])

  useEffect(() => {
    if (!activeChannel) return
    loadMessages(activeChannel)
    loadChannelMembers(activeChannel)
    markAsRead(activeChannel)
    loadSharedFiles(activeChannel)
    setChannels(prev => prev.map(c => c.id === activeChannel ? { ...c, unread_count: 0 } : c))
    const socket = getSocket()
    if (socket) {
      if (socket.connected) {
        socket.emit('chat:join', activeChannel)
      } else {
        const onConnect = () => { socket.emit('chat:join', activeChannel); socket.off('connect', onConnect) }
        socket.on('connect', onConnect)
      }
      return () => { socket.emit('chat:leave', activeChannel) }
    }
  }, [activeChannel, loadMessages, loadChannelMembers, loadSharedFiles, markAsRead])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleConnect = () => { if (activeChannel) socket.emit('chat:join', activeChannel) }
    socket.on('connect', handleConnect)

    const handleReconnect = () => {
      loadChannels()
      loadOrgMembers()
      if (activeChannel) {
        loadMessages(activeChannel)
        loadChannelMembers(activeChannel)
        loadSharedFiles(activeChannel)
      }
    }
    const offReconnect = onReconnect(handleReconnect)

    const handlePresenceSnapshot = (data: { onlineUserIds: string[] }) => {
      setOnlineUsers(new Set(data.onlineUserIds || []))
    }
    socket.on('presence:snapshot', handlePresenceSnapshot)

    const handleMessage = (msg: ChatMessage) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      setChannels(prev => prev.map(c =>
        c.id === msg.channel_id
          ? { ...c, last_message: msg.content || (msg.file_name ? `📎 ${msg.file_name}` : ''), last_message_at: msg.created_at, unread_count: c.id === activeChannel ? 0 : msg.sender_id !== currentUserId ? (c.unread_count || 0) + 1 : (c.unread_count || 0) }
          : c
      ))
      if (activeChannel && msg.channel_id === activeChannel) markAsRead(activeChannel)
      if (msg.file_url && activeChannel && msg.channel_id === activeChannel) loadSharedFiles(activeChannel)
    }

    const handleTyping = (data: { channelId: string; userId: string; isTyping: boolean }) => {
      if (data.channelId !== activeChannel || data.userId === currentUserId) return
      setTypingUsers(prev => {
        const channelTyping = prev[data.channelId] || []
        if (data.isTyping) {
          const member = orgMembers.find(m => m.id === data.userId)
          const name = member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Someone' : 'Someone'
          if (channelTyping.find(t => t.userId === data.userId)) return prev
          return { ...prev, [data.channelId]: [...channelTyping, { userId: data.userId, name }] }
        }
        return { ...prev, [data.channelId]: channelTyping.filter(t => t.userId !== data.userId) }
      })
    }

    socket.on('chat:message', handleMessage)
    socket.on('chat:typing', handleTyping)

    const handleOnline = (data: { userId: string }) => setOnlineUsers(prev => new Set(prev).add(data.userId))
    const handleOffline = (data: { userId: string }) => setOnlineUsers(prev => { const next = new Set(prev); next.delete(data.userId); return next })
    socket.on('user:online', handleOnline)
    socket.on('user:offline', handleOffline)

    const handleRead = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== activeChannel || data.userId === currentUserId) return
      setMemberReads(prev => {
        const existing = prev.find(r => r.user_id === data.userId)
        if (existing) return prev.map(r => r.user_id === data.userId ? { ...r, last_read_at: new Date().toISOString() } : r)
        return [...prev, { user_id: data.userId, last_read_at: new Date().toISOString() }]
      })
    }
    socket.on('chat:read', handleRead)

    const handleMemberLeft = (data: { channelId: string; userId: string }) => {
      setTypingUsers(prev => prev[data.channelId] ? { ...prev, [data.channelId]: prev[data.channelId].filter(t => t.userId !== data.userId) } : prev)
      if (activeChannel === data.channelId) loadChannelMembers(activeChannel)
    }
    socket.on('chat:member_left', handleMemberLeft)

    const handleFileAdded = (data: { channelId: string }) => {
      if (activeChannel && data.channelId === activeChannel) loadSharedFiles(activeChannel)
    }
    socket.on('chat:file_added', handleFileAdded)

    const handleMessageUpdated = (msg: ChatMessage) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m))
      if (activeChannel && msg.channel_id === activeChannel) {
        setChannels(prev => prev.map(c => c.id === msg.channel_id ? { ...c, last_message: msg.content || c.last_message } : c))
      }
    }
    const handleMessageDeleted = (data: { channelId: string; messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId))
      if (activeChannel && data.channelId === activeChannel) loadChannels()
    }
    const handleReactions = (data: { channelId: string; messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
    }
    socket.on('chat:message_updated', handleMessageUpdated)
    socket.on('chat:message_deleted', handleMessageDeleted)
    socket.on('chat:reactions', handleReactions)

    return () => {
      offReconnect()
      socket.off('connect', handleConnect)
      socket.off('presence:snapshot', handlePresenceSnapshot)
      socket.off('chat:message', handleMessage)
      socket.off('chat:typing', handleTyping)
      socket.off('user:online', handleOnline)
      socket.off('user:offline', handleOffline)
      socket.off('chat:read', handleRead)
      socket.off('chat:member_left', handleMemberLeft)
      socket.off('chat:file_added', handleFileAdded)
      socket.off('chat:message_updated', handleMessageUpdated)
      socket.off('chat:message_deleted', handleMessageDeleted)
      socket.off('chat:reactions', handleReactions)
    }
  }, [activeChannel, currentUserId, orgMembers, markAsRead, loadChannels, loadMessages, loadChannelMembers, loadSharedFiles, loadOrgMembers])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!messageText.trim()) { setInputLinkPreview(null); return }
    const urls = messageText.match(URL_REGEX)
    if (!urls) { setInputLinkPreview(null); return }
    const url = urls[0]
    setInputLinkLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/chat/link-preview', { params: { url } })
        setInputLinkPreview(res.data?.title ? res.data : null)
      } catch { setInputLinkPreview(null) }
      setInputLinkLoading(false)
    }, 700)
    return () => { clearTimeout(timer); setInputLinkLoading(false) }
  }, [messageText])

  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try { const res = await api.get('/chat/search', { params: { q } }); setSearchResults(res.data || []) }
      catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
    return () => { clearTimeout(timer); setSearching(false) }
  }, [searchQuery])

  const handleSend = useCallback(async () => {
    if ((!messageText.trim() && !fileInputRef.current?.files?.length) || sending || !activeChannel) return
    setSending(true)
    setSendError('')
    try {
      let fileUrl = ''
      let fileName = ''
      if (fileInputRef.current?.files?.length) {
        const file = fileInputRef.current.files[0]
        if (file.size > 10 * 1024 * 1024) { setSending(false); setSendError('File exceeds 10MB limit'); return }
        const allowedTypes = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|html|md|zip|json|xml|rtf)$/i
        if (!allowedTypes.test(file.name)) { setSending(false); setSendError('File type not supported'); return }
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await api.post('/settings/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        fileUrl = uploadRes.data.url
        fileName = file.name
        fileInputRef.current.value = ''
      }
      const msgRes = await api.post(`/chat/channels/${activeChannel}/messages`, {
        content: messageText.trim() || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
        parent_id: replyTo?.id || undefined,
      })
      setMessages(prev => prev.find(m => m.id === msgRes.data.id) ? prev : [...prev, msgRes.data])
      if (fileUrl) {
        setSharedFiles(prev => [{ id: `temp-${Date.now()}`, channel_id: activeChannel, file_name: fileName, file_url: fileUrl, file_size: 0, file_type: '', created_at: new Date().toISOString(), first_name: user.first_name, last_name: user.last_name, email: user.email } as SharedFile, ...prev])
      }
      setChannels(prev => prev.map(c => c.id === activeChannel ? { ...c, last_message: messageText.trim() || (fileName ? `📎 ${fileName}` : ''), last_message_at: new Date().toISOString() } : c))
      setMessageText('')
      setInputLinkPreview(null)
      setReplyTo(null)
      const socket = getSocket()
      if (socket) socket.emit('chat:typing', { channelId: activeChannel, isTyping: false })
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to send message')
    }
    finally { setSending(false) }
  }, [messageText, sending, activeChannel, user, replyTo])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleTyping = useCallback(() => {
    if (!activeChannel) return
    const socket = getSocket()
    if (!socket) return
    socket.emit('chat:typing', { channelId: activeChannel, isTyping: true })
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { channelId: activeChannel, isTyping: false })
    }, 2000)
  }, [activeChannel])

  const handleCreateGroup = useCallback(async (name: string, memberIds: string[]) => {
    const res = await api.post('/chat/groups', { name, memberIds })
    const channel = res.data
    setChannels(prev => [channel, ...prev])
    setActiveChannel(channel.id)
    return channel
  }, [])

  const handleStartDM = useCallback(async (targetUserId: string) => {
    const res = await api.post(`/chat/channels/dm/${targetUserId}`)
    const channel = res.data
    setChannels(prev => prev.find(c => c.id === channel.id) ? prev : [channel, ...prev])
    setActiveChannel(channel.id)
    return channel
  }, [])

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!activeChannel) return
    await api.delete(`/chat/channels/${activeChannel}/members/${userId}`)
    loadChannelMembers(activeChannel)
  }, [activeChannel, loadChannelMembers])

  const handleLeaveGroup = useCallback(async () => {
    if (!activeChannel) return
    await api.delete(`/chat/channels/${activeChannel}/leave`)
    const removedId = activeChannel
    setChannels(prev => prev.filter(c => c.id !== removedId))
    const remaining = channels.filter(c => c.id !== removedId)
    setActiveChannel(remaining.length > 0 ? remaining[0].id : null)
  }, [activeChannel, channels])

  const saveEdit = useCallback(async (msg: ChatMessage) => {
    if (!editText.trim() || editText === msg.content) { setEditingMessageId(null); return }
    try {
      const res = await api.patch(`/chat/channels/${msg.channel_id}/messages/${msg.id}`, { content: editText.trim() })
      setMessages(prev => prev.map(m => m.id === res.data.id ? { ...m, ...res.data } : m))
      setEditingMessageId(null)
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to edit message')
    }
  }, [editText])

  const confirmDeleteMessage = useCallback(async (msg: ChatMessage) => {
    try {
      await api.delete(`/chat/channels/${msg.channel_id}/messages/${msg.id}`)
      setMessages(prev => prev.filter(m => m.id !== msg.id))
      loadChannels()
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to delete message')
    }
  }, [loadChannels])

  const handleToggleReaction = useCallback(async (msg: ChatMessage, emoji: string) => {
    try {
      const res = await api.post(`/chat/channels/${msg.channel_id}/messages/${msg.id}/reactions`, { emoji })
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: res.data.reactions } : m))
    } catch { /* ignore */ }
  }, [])

  const handleFileUpload = useCallback(async (file: File) => {
    if (!activeChannel) return
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post(`/chat/channels/${activeChannel}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    setSharedFiles(prev => [res.data, ...prev])
    return res.data
  }, [activeChannel])

  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!activeChannel) return
    await api.delete(`/chat/channels/${activeChannel}/files/${fileId}`)
    setSharedFiles(prev => prev.filter(f => f.id !== fileId))
  }, [activeChannel])

  const isMessageSeen = useCallback((msg: ChatMessage): boolean => {
    if (msg.sender_id !== currentUserId) return false
    if (activeChannelData?.type === 'dm') {
      if (!otherLastRead) return false
      return new Date(msg.created_at) <= new Date(otherLastRead)
    }
    if (!memberReads.length) return false
    return memberReads.some(r => r.last_read_at && new Date(msg.created_at) <= new Date(r.last_read_at))
  }, [currentUserId, activeChannelData, otherLastRead, memberReads])

  const getSeenByNames = useCallback((msg: ChatMessage): string => {
    if (activeChannelData?.type === 'dm') return 'Seen'
    const readers = memberReads
      .filter(r => r.last_read_at && new Date(msg.created_at) <= new Date(r.last_read_at))
      .map(r => `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email?.split('@')[0] || 'Someone')
    return readers.length > 0 ? `Seen by ${readers.join(', ')}` : 'Seen'
  }, [activeChannelData, memberReads])

  const getOnlineCount = useCallback((ch: ChatChannel): number => {
    return ch.members ? ch.members.filter(m => onlineUsers.has(m.user_id)).length : 0
  }, [onlineUsers])

  const typingText = activeChannel && typingUsers[activeChannel]?.length
    ? `${typingUsers[activeChannel].map(t => t.name).join(', ')} ${typingUsers[activeChannel].length === 1 ? 'is' : 'are'} typing`
    : ''

  return {
    user, currentUserId,
    channels, activeChannel, setActiveChannel, activeChannelData, totalUnread,
    messages, loading, olderLoading, hasOlder, loadOlderMessages,
    messageText, setMessageText, sending, sendError, setSendError,
    handleSend, handleKeyDown, handleTyping,
    searchQuery, setSearchQuery, searchResults, searching,
    orgMembers, channelMembers, sharedFiles, filesLoading,
    typingUsers, onlineUsers, otherLastRead, memberReads, typingText,
    editingMessageId, setEditingMessageId, editText, setEditText, saveEdit, confirmDeleteMessage,
    replyTo, setReplyTo,
    handleToggleReaction, handleCreateGroup, handleStartDM, handleRemoveMember, handleLeaveGroup,
    handleFileUpload, handleDeleteFile,
    isMessageSeen, getSeenByNames, getOnlineCount,
    inputLinkPreview, inputLinkLoading,
    uploadError, setUploadError,
    messagesEndRef, fileInputRef, msgContainerRef,
    loadChannels, loadChannelMembers, loadSharedFiles,
  }
}
