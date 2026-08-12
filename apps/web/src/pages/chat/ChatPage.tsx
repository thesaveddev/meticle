import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Typography, TextField, Button, IconButton, Avatar, Paper, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, List,
  ListItemAvatar, ListItemText, Badge, Divider, CircularProgress, Chip,
  Tooltip, ListItemButton, Tab, Tabs, Menu, MenuItem, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, Alert, Snackbar,

} from '@mui/material'
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Add as AddIcon,
  Groups as GroupsIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Tag as TagIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Forum as ForumIcon,
  Mood as MoodIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  OpenInNew as OpenInNewIcon,
  Download as DownloadIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { getSocket } from '../../services/socket'

const EMOJIS = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','😎','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','👋','✋','👌','🤌','🤏','👍','👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','🙏','💪','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','🔥','⭐','🌟','✨','💯','✅','❌','❗','❓','💬','📁','📂','📎','🔗','🎉','🎊','🎈','🚀','📌','🎯']

const FILE_PREVIEW_TYPES = new Set(['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/bmp','image/tiff','application/pdf','text/plain','text/html','text/csv','text/javascript','application/json','application/xml','text/xml'])

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"])/gi

function renderMessageText(text: string) {
  const parts: { type: 'text' | 'url'; value: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(URL_REGEX.source, 'gi')
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    parts.push({ type: 'url', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) })
  return parts
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (isToday) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function LinkPreview({ url, isMine }: { url: string; isMine: boolean }) {
  const [data, setData] = useState<{ title: string; description: string; image: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    api.get('/chat/link-preview', { params: { url } })
      .then(r => { if (!cancelled) setData(r.data) })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])
  if (loading) return null
  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
  const title = data?.title || hostname || url
  const description = data?.description || ''
  const image = data?.image || ''
  return (
    <Box component="a" href={url} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      sx={{ display: 'flex', flexDirection: 'row', mt: 0.75, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: isMine ? 'rgba(255,255,255,0.2)' : '#E5E7EB', textDecoration: 'none', color: 'inherit', maxWidth: 360, '&:hover': { opacity: 0.9 } }}>
      {image && (
        <Box sx={{ width: 100, minHeight: 80, bgcolor: '#F3F4F6', flexShrink: 0, overflow: 'hidden' }}>
          <Box component="img" src={image} alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e: any) => { e.target.style.display = 'none' }} />
        </Box>
      )}
      <Box sx={{ p: 1, flex: 1, minWidth: 0, opacity: failed ? 0.6 : 1 }}>
        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.3, fontSize: 12, color: isMine ? '#fff' : '#1F2937' }} noWrap>{title}</Typography>
        {description && (
          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3, mt: 0.25, fontSize: 11, color: isMine ? 'rgba(255,255,255,0.7)' : '#6B7280' }} noWrap>{description}</Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontSize: 10, color: isMine ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }} noWrap>{hostname}</Typography>
      </Box>
    </Box>
  )
}

function SecureImg({ src, alt, sx }: { src: string; alt: string; sx?: any }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const blobRef = useRef('')
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('accessToken')
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        if (cancelled) { URL.revokeObjectURL(URL.createObjectURL(blob)); return }
        blobRef.current = URL.createObjectURL(blob)
        if (imgRef.current) imgRef.current.src = blobRef.current
      })
      .catch(() => { if (!cancelled && imgRef.current) imgRef.current.src = src })
    return () => {
      cancelled = true
      if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = '' }
    }
  }, [src])
  return <Box component="img" ref={imgRef} alt={alt} sx={sx} onError={(e: any) => { e.target.style.display = 'none' }} />
}

function formatFileSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

export default function ChatPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [groupDialog, setGroupDialog] = useState(false)
  const [dmDialog, setDmDialog] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState<any[]>([])
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [groupCreating, setGroupCreating] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; name: string }[]>>({})
  const [showMembers, setShowMembers] = useState(false)
  const [channelMembers, setChannelMembers] = useState<any[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ general: true, groups: true, dms: true })
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [showEmoji, setShowEmoji] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [sharedFiles, setSharedFiles] = useState<any[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [memberMenu, setMemberMenu] = useState<{ anchorEl: HTMLElement; member: any } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [filePreview, setFilePreview] = useState<{ url: string; name: string; type: string } | null>(null)
  const [fileTextContent, setFileTextContent] = useState<string | null>(null)
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null)
  const [sendError, setSendError] = useState('')
  const [filesViewMode, setFilesViewMode] = useState<'list' | 'grid'>('list')
  const [inputLinkPreview, setInputLinkPreview] = useState<{ title: string; description: string; image: string; url: string } | null>(null)
  const [inputLinkLoading, setInputLinkLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sharedFileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const msgContainerRef = useRef<HTMLDivElement>(null)

  const rawUser = (() => { const s = localStorage.getItem('user'); try { const p = s ? JSON.parse(s) : {}; return p && typeof p === 'object' ? p : {} } catch { return {} } })()
  const currentUserId = rawUser.id || rawUser.userId

  const activeChannelData = channels.find(c => c.id === activeChannel)
  const activeChannelName = activeChannelData?.name || ''
  const activeChannelType = activeChannelData?.type || ''

  const getChannelName = (ch: any) => {
    if (ch.type === 'dm' && ch.members) {
      const other = ch.members.find((m: any) => m.user_id !== currentUserId)
      if (other) return `${other.first_name || ''} ${other.last_name || ''}`.trim() || other.email?.split('@')[0] || 'Unknown'
    }
    return ch.name
  }

  const getChannelAvatar = (ch: any) => {
    if (ch.type === 'dm' && ch.members) {
      const other = ch.members.find((m: any) => m.user_id !== currentUserId)
      if (other) return { initials: (other.first_name?.[0] || other.email?.[0] || '?').toUpperCase(), avatar: other.profile_picture_url }
    }
    return { initials: ch.type === 'general' ? '#' : ch.name?.[0]?.toUpperCase() || 'G', avatar: '' }
  }

  const filteredChannels = (type: string) => channels.filter(c => c.type === type)
  const generalChannels = filteredChannels('general')
  const groupChannels = filteredChannels('group')
  const dmChannels = filteredChannels('dm')

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
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

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
    try {
      await api.post(`/chat/channels/${channelId}/read`)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadChannels()
    loadOrgMembers()
  }, [loadChannels, loadOrgMembers])

  // Reset input state on channel change
  useEffect(() => {
    setMessageText('')
    setSendError('')
    setShowEmoji(false)
    setInputLinkPreview(null)
  }, [activeChannel])

  useEffect(() => {
    if (activeChannel) {
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
    }
  }, [activeChannel, loadMessages, loadChannelMembers, loadSharedFiles, markAsRead, activeTab])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // Re-join active channel on socket reconnect
    const handleConnect = () => {
      if (activeChannel) socket.emit('chat:join', activeChannel)
    }
    socket.on('connect', handleConnect)

    const handleMessage = (msg: any) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      setChannels(prev => prev.map(c =>
        c.id === msg.channel_id
          ? {
              ...c,
              last_message: msg.content || (msg.file_name ? '📎 ' + msg.file_name : ''),
              last_message_at: msg.created_at,
              unread_count: c.id === activeChannel ? 0 : msg.sender_id !== currentUserId ? (c.unread_count || 0) + 1 : (c.unread_count || 0)
            }
          : c
      ))
      // Mark as read if it's the active channel
      if (activeChannel && msg.channel_id === activeChannel) {
        markAsRead(activeChannel)
      }
      // Reload shared files when a file message arrives in the active channel
      if (msg.file_url && activeChannel && msg.channel_id === activeChannel) {
        loadSharedFiles(activeChannel)
      }
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
        } else {
          return { ...prev, [data.channelId]: channelTyping.filter(t => t.userId !== data.userId) }
        }
      })
    }

    socket.on('chat:message', handleMessage)
    socket.on('chat:typing', handleTyping)

    const handleOnline = (data: { userId: string }) => {
      setOnlineUsers(prev => new Set(prev).add(data.userId))
    }
    const handleOffline = (data: { userId: string }) => {
      setOnlineUsers(prev => { const next = new Set(prev); next.delete(data.userId); return next })
    }
    socket.on('user:online', handleOnline)
    socket.on('user:offline', handleOffline)

    const handleFileAdded = (data: { channelId: string }) => {
      if (activeChannel && data.channelId === activeChannel) {
        loadSharedFiles(activeChannel)
      }
    }
    socket.on('chat:file_added', handleFileAdded)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('chat:message', handleMessage)
      socket.off('chat:typing', handleTyping)
      socket.off('user:online', handleOnline)
      socket.off('user:offline', handleOffline)
      socket.off('chat:file_added', handleFileAdded)
    }
  }, [activeChannel, currentUserId, orgMembers, markAsRead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Live link preview in input box
  useEffect(() => {
    if (!messageText.trim()) { setInputLinkPreview(null); return }
    const urls = messageText.match(URL_REGEX)
    if (!urls) { setInputLinkPreview(null); return }
    const url = urls[0]
    setInputLinkLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/chat/link-preview', { params: { url } })
        if (res.data?.title) setInputLinkPreview(res.data)
        else setInputLinkPreview(null)
      } catch { setInputLinkPreview(null) }
      setInputLinkLoading(false)
    }, 700)
    return () => { clearTimeout(timer); setInputLinkLoading(false) }
  }, [messageText])

  const handleFileSelect = () => {
    setUploadError('')
    fileInputRef.current?.click()
  }

  const handleSend = async () => {
    if ((!messageText.trim() && !fileInputRef.current?.files?.length) || sending || !activeChannel) return
    setSending(true)
    setSendError('')
    try {
      let fileUrl = ''
      let fileName = ''

      if (fileInputRef.current?.files?.length) {
        const file = fileInputRef.current.files[0]
        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) { setSending(false); setSendError('File exceeds 10MB limit'); return }
        const allowedTypes = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|html|md|zip|json|xml|rtf)$/i
        if (!allowedTypes.test(file.name)) { setSending(false); setSendError('File type not supported'); return }
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await api.post('/settings/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        fileUrl = uploadRes.data.url
        fileName = file.name
        fileInputRef.current.value = ''
      }

      const msgRes = await api.post(`/chat/channels/${activeChannel}/messages`, {
        content: messageText.trim() || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
      })
      setMessages(prev => prev.find(m => m.id === msgRes.data.id) ? prev : [...prev, msgRes.data])
      if (fileUrl) {
        setSharedFiles(prev => [{ id: 'temp-' + Date.now(), channel_id: activeChannel, file_name: fileName, file_url: fileUrl, file_size: 0, file_type: '', created_at: new Date().toISOString(), first_name: rawUser.first_name, last_name: rawUser.last_name, email: rawUser.email } as any, ...prev])
      }
      setChannels(prev => prev.map(c =>
        c.id === activeChannel
          ? { ...c, last_message: messageText.trim() || (fileName ? '📎 ' + fileName : ''), last_message_at: new Date().toISOString() }
          : c
      ))
      setMessageText('')
      setInputLinkPreview(null)
      const socket = getSocket()
      if (socket) socket.emit('chat:typing', { channelId: activeChannel, isTyping: false })
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to send message')
    }
    finally { setSending(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleTyping = () => {
    if (!activeChannel) return
    const socket = getSocket()
    if (!socket) return
    socket.emit('chat:typing', { channelId: activeChannel, isTyping: true })
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { channelId: activeChannel, isTyping: false })
    }, 2000)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setGroupCreating(true)
    try {
      const res = await api.post('/chat/groups', {
        name: groupName.trim(),
        memberIds: groupMembers.map(m => m.id),
      })
      const channel = res.data
      setChannels(prev => [channel, ...prev])
      setActiveChannel(channel.id)
      setGroupDialog(false); setGroupName(''); setGroupMembers([])
    } catch { /* ignore */ }
    finally { setGroupCreating(false) }
  }

  const handleStartDM = async (targetUserId: string) => {
    try {
      const res = await api.post(`/chat/channels/dm/${targetUserId}`)
      const channel = res.data
      setChannels(prev => prev.find(c => c.id === channel.id) ? prev : [channel, ...prev])
      setActiveChannel(channel.id)
      setDmDialog(false)
    } catch { /* ignore */ }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!activeChannel) return
    try {
      await api.delete(`/chat/channels/${activeChannel}/members/${userId}`)
      loadChannelMembers(activeChannel)
      setRemoveConfirm(null); setMemberMenu(null)
    } catch { /* ignore */ }
  }

  const handleSharedFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChannel) return
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/chat/channels/${activeChannel}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSharedFiles(prev => [res.data, ...prev])
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload failed')
    }
    finally { setUploadingFile(false); if (e.target) e.target.value = '' }
  }

  const handleDeleteSharedFile = async (fileId: string) => {
    if (!activeChannel) return
    try {
      await api.delete(`/chat/channels/${activeChannel}/files/${fileId}`)
      setSharedFiles(prev => prev.filter(f => f.id !== fileId))
    } catch { /* ignore */ }
  }

  const toggleSection = (section: string) => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))

  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji); setShowEmoji(false); handleTyping()
  }

  const getMemberName = (msg: any) => `${msg.first_name || ''} ${msg.last_name || ''}`.trim() || msg.email?.split('@')[0] || 'Unknown'

  const getMemberAvatar = (msg: any) => (msg.first_name?.[0] || msg.email?.[0] || '?').toUpperCase()

  const typingText = activeChannel && typingUsers[activeChannel]?.length
    ? `${typingUsers[activeChannel].map(t => t.name).join(', ')} ${typingUsers[activeChannel].length === 1 ? 'is' : 'are'} typing...`
    : ''

  const getOnlineCount = (ch: any) => ch.members ? ch.members.filter((m: any) => onlineUsers.has(m.user_id)).length : 0

  const isMessageSeen = (msg: any) => {
    if (msg.sender_id !== currentUserId) return false
    if (!otherLastRead) return false
    return new Date(msg.created_at) <= new Date(otherLastRead)
  }

  const openFilePreview = async (url: string, name: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const contentType = res.headers.get('content-type') || ''
      if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/xml') {
        const text = await res.text()
        setFileTextContent(text)
        const blob = new Blob([text], { type: contentType })
        setFilePreview({ url: URL.createObjectURL(blob), name, type: contentType })
      } else {
        const blob = await res.blob()
        setFileTextContent(null)
        setFilePreview({ url: URL.createObjectURL(blob), name, type: blob.type })
      }
    } catch {
      window.open(url, '_blank')
    }
  }

  const handleDownload = async (url: string, name: string) => {
    const token = localStorage.getItem('accessToken')
    try {
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch { /* silent */ }
  }

  const SidebarSection = ({ title, sectionKey, icon, items, avatarFn, nameFn }: any) => (
    <>
      <ListItemButton dense sx={{ px: 2, py: 0.75 }} onClick={() => toggleSection(sectionKey)}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ width: '100%' }}>
          {icon}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>{title}</Typography>
          <Chip label={items.length} size="small" sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.5 } }} />
          {expandedSections[sectionKey] ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </Stack>
      </ListItemButton>
      {expandedSections[sectionKey] && items.map((ch: any) => {
        const { initials, avatar } = avatarFn(ch)
        const isDM = ch.type === 'dm'
        const otherUserId = isDM && ch.members ? ch.members.find((m: any) => m.user_id !== currentUserId)?.user_id : null
        const isOnline = otherUserId && onlineUsers.has(otherUserId)
        const onlineCount = ch.type === 'general' || ch.type === 'group' ? getOnlineCount(ch) : 0
        return (
          <ListItemButton key={ch.id}
            selected={activeChannel === ch.id}
            onClick={() => { setActiveChannel(ch.id); setActiveTab(0) }}
            sx={{ borderRadius: 1, mx: 0.75, my: 0.25, py: 0.75 }}
          >
            <ListItemAvatar sx={{ minWidth: 36 }}>
              <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={isDM && isOnline ? <Box sx={{ width: 10, height: 10, bgcolor: '#22C55E', borderRadius: '50%', border: '2px solid #fff' }} /> : null}>
                <Avatar src={avatar || undefined} sx={{ bgcolor: ch.type === 'general' ? '#0F4C81' : ch.type === 'dm' ? '#0891B2' : '#7C3AED', width: 32, height: 32, fontSize: 13 }}>
                  {initials}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography variant="body2" fontWeight={activeChannel === ch.id ? 700 : 500} noWrap sx={{ fontSize: 13.5 }}>{nameFn(ch)}</Typography>
                  {isDM && isOnline && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E' }} />}
                  {(ch.type === 'general' || ch.type === 'group') && onlineCount > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{onlineCount} online</Typography>
                  )}
                </Stack>
              }
              secondary={ch.last_message ? ch.last_message.substring(0, 26) + (ch.last_message.length > 26 ? '...' : '') : 'No messages yet'}
              secondaryTypographyProps={{ fontSize: 11.5, noWrap: true, color: ch.unread_count > 0 && ch.id !== activeChannel ? 'text.primary' : 'text.secondary' }}
            />
            <Stack alignItems="flex-end" spacing={0.25} sx={{ ml: 0.5 }}>
              {ch.last_message_at && (
                <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', whiteSpace: 'nowrap' }}>
                  {timeAgo(ch.last_message_at)}
                </Typography>
              )}
              {ch.unread_count > 0 && ch.id !== activeChannel && (
                <Badge badgeContent={ch.unread_count} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16, p: 0 } }} />
              )}
            </Stack>
          </ListItemButton>
        )
      })}
    </>
  )

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 112px)', gap: 0, overflow: 'hidden', bgcolor: '#F0F2F5', borderRadius: 2 }}>
      {/* Sidebar */}
      {drawerOpen && (
        <Paper sx={{ width: 300, minWidth: 300, display: 'flex', flexDirection: 'column', borderRadius: 0, borderRight: '1px solid', borderColor: 'divider', bgcolor: '#FAFBFC' }} elevation={0}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ForumIcon sx={{ color: '#0F4C81', fontSize: 22 }} />
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: 18 }}>Chat</Typography>
                {totalUnread > 0 && <Chip label={totalUnread} size="small" color="error" sx={{ height: 20, minWidth: 20, fontSize: 11, '& .MuiChip-label': { px: 0.5 } }} />}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="New Direct Message">
                  <IconButton size="small" onClick={() => setDmDialog(true)} sx={{ bgcolor: '#F3F4F6', '&:hover': { bgcolor: '#E5E7EB' } }}>
                    <PersonIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Create Group">
                  <IconButton size="small" onClick={() => setGroupDialog(true)} sx={{ bgcolor: '#F3F4F6', '&:hover': { bgcolor: '#E5E7EB' } }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            <TextField size="small" placeholder="Search conversations..." fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F3F4F6', fontSize: 13 } }} />
          </Box>
          <List sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
            {generalChannels.length > 0 && <SidebarSection title="General" sectionKey="general" icon={<TagIcon sx={{ fontSize: 16, color: '#0F4C81' }} />} items={generalChannels} avatarFn={() => ({ initials: '#', avatar: '' })} nameFn={(ch: any) => ch.name} />}
            {groupChannels.length > 0 && <><Divider sx={{ my: 0.5 }} /><SidebarSection title="Groups" sectionKey="groups" icon={<GroupsIcon sx={{ fontSize: 16, color: '#7C3AED' }} />} items={groupChannels} avatarFn={(ch: any) => ({ initials: ch.name?.[0]?.toUpperCase() || 'G', avatar: '' })} nameFn={(ch: any) => ch.name} /></>}
            {dmChannels.length > 0 && <><Divider sx={{ my: 0.5 }} /><SidebarSection title="Direct Messages" sectionKey="dms" icon={<ForumIcon sx={{ fontSize: 16, color: '#0891B2' }} />} items={dmChannels} avatarFn={getChannelAvatar} nameFn={getChannelName} /></>}
            {channels.length === 0 && <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center', fontSize: 13 }}>No conversations yet</Typography>}
          </List>
        </Paper>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Paper sx={{ p: 1.5, borderRadius: 0, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fff' }} elevation={0}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {!drawerOpen && <IconButton size="small" onClick={() => setDrawerOpen(true)}><ArrowBackIcon /></IconButton>}
            {activeChannelType === 'general' || activeChannelType === 'group' ? (
              <Avatar sx={{ bgcolor: activeChannelType === 'general' ? '#0F4C81' : '#7C3AED', width: 38, height: 38, fontSize: 15 }}>
                {activeChannelType === 'general' ? '#' : activeChannelName?.[0]?.toUpperCase() || 'C'}
              </Avatar>
            ) : (
              <Avatar src={activeChannelData ? getChannelAvatar(activeChannelData).avatar || undefined : undefined}
                sx={{ bgcolor: '#D97706', width: 38, height: 38, fontSize: 15 }}>
                {activeChannelData ? getChannelAvatar(activeChannelData).initials : '?'}
              </Avatar>
            )}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>{activeChannelName || 'Select a conversation'}</Typography>
                {(activeChannelType === 'general' || activeChannelType === 'group') && getOnlineCount(activeChannelData) > 0 && (
                  <Chip label={`${getOnlineCount(activeChannelData)} online`} size="small" sx={{ height: 20, fontSize: 11, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />
                )}
                {activeChannelType === 'dm' && onlineUsers.has(channelMembers.find((m: any) => m.user_id !== currentUserId)?.user_id) && (
                  <Chip label="Online" size="small" sx={{ height: 20, fontSize: 11, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {activeChannelType === 'general' ? 'General channel' : activeChannelType === 'group' ? `${channelMembers.length} members` : activeChannelType === 'dm' ? 'Direct message' : ''}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {(activeChannelType === 'group' || activeChannelType === 'general') && channelMembers.length > 0 && (
              <Stack direction="row" spacing={-0.75} alignItems="center" sx={{ mr: 1 }}>
                {channelMembers.slice(0, 6).map((m: any, i: number) => (
                  <Tooltip key={m.user_id} title={`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: ['#0F4C81','#7C3AED','#D97706','#059669','#DC2626','#6B7280'][i % 6], border: '2px solid #fff', ml: i === 0 ? 0 : -0.75, zIndex: 6 - i }}>
                      {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
                {channelMembers.length > 6 && (
                  <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: '#374151', border: '2px solid #fff', ml: -0.75, zIndex: 0 }}>
                    +{channelMembers.length - 6}
                  </Avatar>
                )}
              </Stack>
            )}
            {/* Only show View Members for groups/general, NOT DMs */}
            {activeChannelType !== 'dm' && (
              <Tooltip title="View Members">
                <IconButton size="small" onClick={() => { setShowMembers(true); loadChannelMembers(activeChannel!) }} disabled={!activeChannel} sx={{ bgcolor: '#F3F4F6' }}>
                  <GroupsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setDrawerOpen(prev => !prev)} sx={{ bgcolor: '#F3F4F6' }}>
              <ForumIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Paper>

        {/* Tab bar */}
        {activeChannel && (
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff', px: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); if (v === 1) loadSharedFiles(activeChannel!) }} sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none', fontWeight: 600, fontSize: 13 } }}>
              <Tab label="Messages" />
              <Tab label={`Files (${sharedFiles.length})`} />
            </Tabs>
          </Box>
        )}

        {/* Content */}
        {activeTab === 0 ? (
          <>
            {/* Messages */}
            <Paper ref={msgContainerRef} sx={{ flex: 1, overflow: 'auto', p: 2.5, borderRadius: 0, display: 'flex', flexDirection: 'column', bgcolor: '#fff' }} elevation={0}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><CircularProgress size={24} /></Box>
              ) : messages.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, flexDirection: 'column', gap: 1 }}>
                  <ForumIcon sx={{ fontSize: 48, color: '#D1D5DB' }} />
                  <Typography color="text.secondary" sx={{ fontSize: 14 }}>No messages yet. Start the conversation!</Typography>
                </Box>
              ) : (() => {
                const unreadIdx = otherLastRead
                  ? messages.findIndex(msg => new Date(msg.created_at) > new Date(otherLastRead))
                  : -1
                return messages.map((msg, i) => {
                  const isUnreadStart = i === unreadIdx
                  const isMine = msg.sender_id === currentUserId
                  const showAvatar = i === 0 || messages[i - 1]?.sender_id !== msg.sender_id
                  const msgDate = new Date(msg.created_at)
                  const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null
                  const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString()
                  const seen = isMine && isMessageSeen(msg)
                  const colors = ['#E0F2FE','#FCE7F3','#EDE9FE','#D1FAE5','#FEF3C7','#FEE2E2']
                  const cIdx = msg.sender_id.charCodeAt(0) % colors.length
                  return (
                    <Box key={msg.id}>
                      {isUnreadStart && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 1.5 }}>
                          <Divider sx={{ flex: 1 }} />
                          <Chip label="New messages" size="small" color="primary" sx={{ fontSize: 11, fontWeight: 600, bgcolor: '#DBEAFE', color: '#1E40AF' }} />
                          <Divider sx={{ flex: 1 }} />
                        </Stack>
                      )}
                      {showDateDivider && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 1.5 }}>
                          <Divider sx={{ flex: 1 }} />
                          <Chip label={formatDate(msg.created_at)} size="small" variant="outlined" sx={{ fontSize: 11, fontWeight: 600 }} />
                          <Divider sx={{ flex: 1 }} />
                        </Stack>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 0.75 }}
                        className="message-group">
                        <Stack direction={isMine ? 'row-reverse' : 'row'} spacing={1} alignItems="flex-end" sx={{ maxWidth: '72%' }}>
                          {showAvatar ? (
                            isMine ? (
                              <Avatar src={rawUser.profile_picture_url || undefined} sx={{ width: 30, height: 30, fontSize: 12, bgcolor: '#0F4C81', border: '2px solid #E5E7EB' }}>
                                {(rawUser.first_name?.[0] || rawUser.email?.[0] || '?').toUpperCase()}
                              </Avatar>
                            ) : (
                              <Avatar src={msg.profile_picture_url || undefined} sx={{ width: 30, height: 30, fontSize: 12, bgcolor: colors[cIdx], border: '2px solid #E5E7EB' }}>
                                {getMemberAvatar(msg)}
                              </Avatar>
                            )
                          ) : (
                            <Box sx={{ width: 30 }} />
                          )}
                          <Box sx={{ maxWidth: '100%' }}>
                            {showAvatar && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, textAlign: isMine ? 'right' : 'left', fontWeight: 600, fontSize: 11 }}>
                                {isMine ? 'You' : getMemberName(msg)}
                              </Typography>
                            )}
                            <Paper sx={{
                              px: msg.content ? 1.5 : 0.75, py: msg.content ? 0.75 : 0.5,
                              borderRadius: 2,
                              bgcolor: isMine ? '#0F4C81' : '#F3F4F6',
                              color: isMine ? '#fff' : '#1F2937',
                              borderBottomRightRadius: isMine && !showAvatar ? 1 : 2,
                              borderBottomLeftRadius: !isMine && !showAvatar ? 1 : 2,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                              position: 'relative',
                            }} elevation={0}>
                              {msg.content && (
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, fontSize: 13.5 }}>
                                  {renderMessageText(msg.content).map((part, i) =>
                                    part.type === 'url' ? (
                                      <Typography key={i} component="a" href={part.value} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{ color: isMine ? '#BBDEFB' : '#2563EB', textDecoration: 'underline', fontWeight: 500, '&:hover': { opacity: 0.8 } }}>
                                        {part.value}
                                      </Typography>
                                    ) : (
                                      <span key={i}>{part.value}</span>
                                    )
                                  )}
                                </Typography>
                              )}
                              {msg.content && renderMessageText(msg.content).filter(p => p.type === 'url').map((part, i) => (
                                <LinkPreview key={`preview-${i}`} url={part.value} isMine={isMine} />
                              ))}
                              {msg.file_url && (
                                <Box sx={{ mt: msg.content ? 0.75 : 0 }}>
                                  {FILE_PREVIEW_TYPES.has(msg.file_type || '') || msg.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|pdf)$/i) ? (
                                    <Box sx={{ cursor: 'pointer' }} onClick={() => openFilePreview(msg.file_url, msg.file_name || 'File')}>
                                      {msg.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ? (
                                        <SecureImg src={msg.file_url} alt={msg.file_name}
                                          sx={{ maxWidth: 200, maxHeight: 150, borderRadius: 1, objectFit: 'cover', display: 'block', bgcolor: '#F3F4F6' }} />
                                      ) : (
                                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ bgcolor: isMine ? 'rgba(255,255,255,0.1)' : '#E5E7EB', borderRadius: 1, p: 0.75 }}>
                                          <FileIcon sx={{ fontSize: 20, color: isMine ? '#fff' : '#6B7280' }} />
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                              {msg.file_name || 'File'}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                              <OpenInNewIcon sx={{ fontSize: 12 }} /> Click to preview
                                            </Typography>
                                          </Box>
                                        </Stack>
                                      )}
                                    </Box>
                                  ) : (
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                      <AttachFileIcon sx={{ fontSize: 16, color: isMine ? '#BBDEFB' : '#6B7280' }} />
                                      <Typography variant="caption" component="a" href={msg.file_url} target="_blank" rel="noopener"
                                        sx={{ color: isMine ? '#BBDEFB' : '#0F4C81', textDecoration: 'underline', fontWeight: 500, fontSize: 12 }}>
                                        {msg.file_name || 'View file'}
                                      </Typography>
                                    </Stack>
                                  )}
                                </Box>
                              )}
                            </Paper>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>{formatTime(msg.created_at)}</Typography>
                              {isMine && seen && (
                                <Tooltip title="Seen">
                                  <DoneAllIcon sx={{ fontSize: 13, color: '#3B82F6' }} />
                                </Tooltip>
                              )}
                              {isMine && !seen && msg.sender_id === currentUserId && otherLastRead && (
                                <CheckIcon sx={{ fontSize: 13, color: '#9CA3AF' }} />
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    </Box>
                  )
                })
              })()
            }
              {typingText && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1, mt: 0.5 }}>
                  <CircularProgress size={12} sx={{ color: '#9CA3AF' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: 12 }}>{typingText}</Typography>
                </Stack>
              )}
              <div ref={messagesEndRef} />
            </Paper>

            {/* Live input link preview */}
            {inputLinkPreview && (
              <Box sx={{ px: 1.5, pt: 1.5, bgcolor: '#fff', borderTop: '1px solid', borderColor: 'divider' }}>
                <Box component="a" href={inputLinkPreview.url} target="_blank" rel="noopener noreferrer"
                  sx={{ display: 'flex', flexDirection: 'row', borderRadius: 1.5, overflow: 'hidden', border: '1px solid #E5E7EB', textDecoration: 'none', color: 'inherit', maxWidth: 360, bgcolor: '#FAFBFC', '&:hover': { opacity: 0.9 } }}>
                  {inputLinkPreview.image && (
                    <Box sx={{ width: 80, minHeight: 64, bgcolor: '#F3F4F6', flexShrink: 0, overflow: 'hidden' }}>
                      <Box component="img" src={inputLinkPreview.image} alt=""
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e: any) => { e.target.style.display = 'none' }} />
                    </Box>
                  )}
                  <Box sx={{ p: 0.75, flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.3, fontSize: 11, color: '#374151' }} noWrap>{inputLinkPreview.title}</Typography>
                    {inputLinkPreview.description && (
                      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3, mt: 0.125, fontSize: 10, color: '#6B7280' }} noWrap>{inputLinkPreview.description}</Typography>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.125, fontSize: 9, color: '#9CA3AF' }} noWrap>{(() => { try { return new URL(inputLinkPreview.url).hostname } catch { return inputLinkPreview.url } })()}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
            {inputLinkLoading && (
              <Box sx={{ px: 1.5, pt: 1.5, bgcolor: '#fff', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>Loading preview...</Typography>
              </Box>
            )}
            {/* Input */}
            <Paper sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff' }} elevation={0}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <Tooltip title="Attach file">
                  <span>
                    <IconButton size="small" onClick={handleFileSelect} disabled={!activeChannel}>
                      <AttachFileIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.length) handleSend() }} />
                <Box sx={{ position: 'relative', flex: 1 }}>
                  <TextField fullWidth size="small" multiline maxRows={3} autoFocus
                    placeholder={activeChannel ? 'Type a message...' : 'Select a conversation'}
                    value={messageText}
                    onChange={e => { setMessageText(e.target.value); handleTyping() }}
                    onKeyDown={handleKeyDown}
                    disabled={!activeChannel}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F9FAFB', pr: 5 } }}
                    InputProps={{
                      endAdornment: activeChannel && (
                        <Box sx={{ position: 'absolute', right: 8, bottom: 6 }}>
                          <IconButton size="small" onClick={() => setShowEmoji(!showEmoji)}>
                            <MoodIcon sx={{ fontSize: 20, color: '#9CA3AF' }} />
                          </IconButton>
                        </Box>
                      )
                    }}
                  />
                  {showEmoji && (
                    <Paper ref={emojiRef} sx={{ position: 'absolute', bottom: '100%', right: 0, mb: 1, p: 1, maxWidth: 320, maxHeight: 200, overflow: 'auto', borderRadius: 2, boxShadow: 3, zIndex: 10 }} elevation={3}>
                      <Stack direction="row" flexWrap="wrap" spacing={0.5} useFlexGap>
                        {EMOJIS.map(e => (
                          <Typography key={e} sx={{ cursor: 'pointer', fontSize: 22, lineHeight: 1.4, '&:hover': { transform: 'scale(1.3)', transition: '0.15s' } }} onClick={() => insertEmoji(e)}>{e}</Typography>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </Box>
                <Button variant="contained" onClick={handleSend}
                  disabled={sending || (!messageText.trim() && !fileInputRef.current?.files?.length) || !activeChannel}
                  sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, minWidth: 40, px: 2, borderRadius: 2, height: 40 }}>
                  {sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon />}
                </Button>
              </Stack>
            </Paper>
          </>
        ) : (
          /* Files tab */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={700}>Shared Files</Typography>
                <Chip label={sharedFiles.length} size="small" sx={{ height: 20, fontSize: 11 }} />
                <IconButton size="small" onClick={() => setFilesViewMode('list')} sx={{ color: filesViewMode === 'list' ? '#0F4C81' : '#9CA3AF' }}>
                  <ViewListIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setFilesViewMode('grid')} sx={{ color: filesViewMode === 'grid' ? '#0F4C81' : '#9CA3AF' }}>
                  <GridViewIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Button variant="outlined" size="small" component="label" startIcon={<AttachFileIcon />} disabled={uploadingFile}>
                {uploadingFile ? 'Uploading...' : 'Upload File'}
                <input type="file" ref={sharedFileInputRef} hidden onChange={handleSharedFileUpload} />
              </Button>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {filesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>
              ) : sharedFiles.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1, py: 6 }}>
                  <FileIcon sx={{ fontSize: 48, color: '#D1D5DB' }} />
                  <Typography color="text.secondary">No shared files yet. Upload documents, policies, plans, and minutes for the team.</Typography>
                </Box>
              ) : filesViewMode === 'grid' ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                  {sharedFiles.map(f => {
                    const isImage = f.file_url?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)
                    return (
                      <Paper key={f.id} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative', '&:hover': { boxShadow: 3, '& .download-overlay': { opacity: 1 } } }} onClick={() => openFilePreview(f.file_url, f.file_name)}>
                        <Box sx={{ height: 140, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {isImage ? (
                            <SecureImg src={f.file_url} alt={f.file_name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <FileIcon sx={{ fontSize: 48, color: '#9CA3AF' }} />
                          )}
                        </Box>
                        <IconButton className="download-overlay"
                          onClick={(e) => { e.stopPropagation(); handleDownload(f.file_url, f.file_name) }}
                          sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.9)', opacity: 0, transition: 'opacity 0.2s', '&:hover': { bgcolor: '#fff' } }}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        <Box sx={{ p: 1.25 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 13 }}>{f.file_name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, display: 'block' }}>
                            {`${f.first_name || ''} ${f.last_name || ''}`.trim() || f.email || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                            {f.file_size ? formatFileSize(f.file_size) : ''}{f.file_size && f.created_at ? ' · ' : ''}{f.created_at ? formatDate(f.created_at) : ''}
                          </Typography>
                        </Box>
                      </Paper>
                    )
                  })}
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Uploaded By</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sharedFiles.map(f => (
                        <TableRow key={f.id} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FileIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                              <Typography variant="body2" component="a" onClick={() => openFilePreview(f.file_url, f.file_name)}
                                sx={{ color: '#0F4C81', textDecoration: 'underline', fontWeight: 500, cursor: 'pointer' }}>
                                {f.file_name}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{`${f.first_name || ''} ${f.last_name || ''}`.trim() || f.email}</TableCell>
                          <TableCell>{f.file_size ? formatFileSize(f.file_size) : '—'}</TableCell>
                          <TableCell>{formatDate(f.created_at)}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleDownload(f.file_url, f.file_name)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteSharedFile(f.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* File Preview Dialog */}
      <Dialog open={!!filePreview} onClose={() => { if (filePreview?.url.startsWith('blob:')) URL.revokeObjectURL(filePreview.url); setFilePreview(null); setFileTextContent(null) }} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FileIcon />
            <Typography variant="h6" fontWeight={700}>{filePreview?.name || 'File Preview'}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton component="a" href={filePreview?.url} download={filePreview?.name}><DownloadIcon /></IconButton>
            <IconButton onClick={() => { if (filePreview?.url.startsWith('blob:')) URL.revokeObjectURL(filePreview.url); setFilePreview(null); setFileTextContent(null) }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#F9FAFB' }}>
          {filePreview?.type === 'application/pdf' ? (
            <Box sx={{ width: '100%', height: '70vh' }}>
              <iframe src={filePreview.url} title={filePreview.name} width="100%" height="100%" style={{ border: 'none' }} />
            </Box>
          ) : filePreview?.type.startsWith('image/') ? (
            <Box component="img" src={filePreview.url} alt={filePreview.name}
              sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }} />
          ) : fileTextContent !== null ? (
            <Box sx={{ width: '100%', height: '70vh', overflow: 'auto', bgcolor: '#1F2937', borderRadius: 1, p: 2 }}>
              <pre style={{ color: '#E5E7EB', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '"Fira Code","Consolas","Monaco","Courier New",monospace', fontSize: 13, lineHeight: 1.5 }}>
                {fileTextContent}
              </pre>
            </Box>
          ) : (
            <Stack spacing={2} alignItems="center">
              <FileIcon sx={{ fontSize: 64, color: '#9CA3AF' }} />
              <Typography color="text.secondary">Preview not available for this file type</Typography>
              <Button variant="contained" component="a" href={filePreview?.url} download={filePreview?.name} startIcon={<DownloadIcon />}>
                Download
              </Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={groupDialog} onClose={() => setGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FAFBFC' }}>Create Group</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <TextField label="Group Name" fullWidth size="small" value={groupName} onChange={e => setGroupName(e.target.value)} helperText="Give your group a descriptive name" />
            <Autocomplete multiple options={orgMembers.filter(m => m.id !== currentUserId)}
              getOptionLabel={(o) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              value={groupMembers} onChange={(_, v) => setGroupMembers(v)}
              renderInput={(params) => <TextField {...params} label="Add Members" size="small" helperText="Select team members to add" />}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#7C3AED' }}>{(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}</Avatar>
                    <Box><Typography variant="body2" fontWeight={600}>{`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}</Typography><Typography variant="caption" color="text.secondary">{option.role}</Typography></Box>
                  </Stack>
                </li>
              )} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setGroupDialog(false)} color="inherit">Cancel</Button>
          <Button variant="contained" disabled={groupCreating || !groupName.trim()} onClick={handleCreateGroup} sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
            {groupCreating ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DM Dialog */}
      <Dialog open={dmDialog} onClose={() => setDmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FAFBFC' }}>New Message</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">Select a colleague to start a direct conversation</Typography>
            <Autocomplete options={orgMembers.filter(m => m.id !== currentUserId)}
              getOptionLabel={(o) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              onChange={(_, v) => { if (v) handleStartDM(v.id) }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#D97706' }}>{(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}</Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}</Typography>
                      <Typography variant="caption" color="text.secondary">{option.role}</Typography>
                    </Box>
                    {onlineUsers.has(option.id) && <Chip label="Online" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#DCFCE7', color: '#166534' }} />}
                  </Stack>
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Search staff" size="small" autoFocus />} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDmDialog(false)} color="inherit">Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Members Dialog - only for groups/general */}
      <Dialog open={showMembers} onClose={() => setShowMembers(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FAFBFC' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupsIcon /><Typography variant="h6" fontWeight={700}>{activeChannelName}</Typography>
            <Chip label={`${channelMembers.length} members`} size="small" sx={{ ml: 1 }} />
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List sx={{ py: 0 }}>
            {channelMembers.map((m: any) => (
              <ListItemButton key={m.user_id} sx={{ borderRadius: 0, px: 3, py: 1.5, '&:hover': { bgcolor: '#F9FAFB' } }}
                onContextMenu={(e) => { e.preventDefault(); setMemberMenu({ anchorEl: e.currentTarget, member: m }) }}>
                <ListItemAvatar>
                  <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={onlineUsers.has(m.user_id) ? <Box sx={{ width: 10, height: 10, bgcolor: '#22C55E', borderRadius: '50%', border: '2px solid #fff' }} /> : null}>
                    <Avatar sx={{ width: 38, height: 38, fontSize: 14, bgcolor: m.user_id === currentUserId ? '#0F4C81' : '#7C3AED' }}>
                      {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={<Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={600} sx={{ fontSize: 14 }}>{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</Typography>{onlineUsers.has(m.user_id) && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E' }} />}</Stack>}
                  secondary={m.user_id === currentUserId ? 'You · ' + m.role : m.role}
                  secondaryTypographyProps={{ fontSize: 12 }} />
                {m.user_id !== currentUserId && (
                  <Tooltip title="Send Message">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleStartDM(m.user_id); setShowMembers(false) }}>
                      <ForumIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMembers(false)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Member context menu */}
      <Menu anchorEl={memberMenu?.anchorEl} open={!!memberMenu} onClose={() => setMemberMenu(null)}>
        <MenuItem onClick={() => { if (memberMenu) { handleStartDM(memberMenu.member.user_id); setShowMembers(false); setMemberMenu(null) } }}>
          <ForumIcon sx={{ mr: 1, fontSize: 18 }} /> Send Message
        </MenuItem>
        {memberMenu?.member?.user_id !== currentUserId && activeChannelType !== 'dm' && (
          <MenuItem onClick={() => { setRemoveConfirm(memberMenu!.member.user_id); setMemberMenu(null) }} sx={{ color: '#DC2626' }}>
            <CloseIcon sx={{ mr: 1, fontSize: 18 }} /> Remove from Group
          </MenuItem>
        )}
      </Menu>

      {/* Remove confirm */}
      <Dialog open={!!removeConfirm} onClose={() => setRemoveConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent><Alert severity="warning">Are you sure you want to remove this member from the group?</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveConfirm(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" onClick={() => handleRemoveMember(removeConfirm!)}>Remove</Button>
        </DialogActions>
      </Dialog>

      {/* Upload error snackbar */}
      <Snackbar open={!!uploadError} autoHideDuration={4000} onClose={() => setUploadError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setUploadError('')} variant="filled">{uploadError}</Alert>
      </Snackbar>

      {/* Send error snackbar */}
      <Snackbar open={!!sendError} autoHideDuration={4000} onClose={() => setSendError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSendError('')} variant="filled">{sendError}</Alert>
      </Snackbar>
    </Box>
  )
}
