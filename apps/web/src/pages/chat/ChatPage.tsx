import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Typography, TextField, Button, IconButton, Avatar, Paper, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, List,
  ListItemAvatar, ListItemText, Badge, CircularProgress, Chip,
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
import { getSocket, onReconnect } from '../../services/socket'

/* MeticleCare operational world — chat window
   THESIS: one conversation console for the care team; the chat is a framed window seated on warm bone, not a floating gray slab.
   OWN-WORLD: deep navy #0F4C81 carries identity and self-messages; a single emerald #10B981 accent marks presence and unread; ink #1B2430 text on bone #F7F4EE / white grounds with #E7E1D6 editorial hairlines; Inter only; flat surfaces.
   STORY: a care manager opens one calm console, sees who is on shift, and the team's working day continues in one thread.
   FIRST VIEWPORT: a bone desk seats a white window with a chrome sidebar (channels), a quiet thread on bone, and a navy composer.
   FORM: framed-window operational world.
   FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md */

const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const INK = '#1B2430'
const MIST = '#5B6672'
const BONE = '#F7F4EE'
const HAIRLINE = '#E7E1D6'
const WINDOW_BORDER = '#E0D9CA'
const OUTLINE = '#C9C2B4'
const CHROME = '#FCFAF6'
const WHITE = '#FFFFFF'
const DANGER = '#DC2626'
const WINDOW_SHADOW = '0 32px 64px -28px rgba(20, 32, 45, 0.35)'
const SEAT_SHADOW = '0 1px 2px rgba(20, 32, 45, 0.06)'

const EMOJIS = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','😎','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','👋','✋','👌','🤌','🤏','👍','👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','🙏','💪','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','🔥','⭐','🌟','✨','💯','✅','❌','❗','❓','💬','📁','📂','📎','🔗','🎉','🎊','🎈','🚀','📌','🎯']

const FILE_PREVIEW_TYPES = new Set(['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/bmp','image/tiff','application/pdf','text/plain','text/html','text/csv','text/javascript','application/json','application/xml','text/xml'])

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"])/gi

const MENTION_REGEX = /(^|[\s(])(@[A-Za-z0-9][A-Za-z0-9 .'\-]*)/gi

function renderMessageText(text: string) {
  const parts: { type: 'text' | 'url' | 'mention'; value: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const markers: { index: number; end: number; type: 'url' | 'mention'; value: string }[] = []

  const urlRegex = new RegExp(URL_REGEX.source, 'gi')
  while ((match = urlRegex.exec(text)) !== null) {
    markers.push({ index: match.index, end: match.index + match[0].length, type: 'url', value: match[0] })
  }
  const mentionRegex = new RegExp(MENTION_REGEX.source, 'gi')
  while ((match = mentionRegex.exec(text)) !== null) {
    const prefix = match[1]
    const mentionStart = match.index + prefix.length
    markers.push({ index: mentionStart, end: mentionStart + match[2].length, type: 'mention', value: match[2] })
  }
  markers.sort((a, b) => a.index - b.index)

  // Drop nested markers (mention that overlaps a URL)
  const clean: typeof markers = []
  for (const marker of markers) {
    if (clean.length > 0 && marker.index < clean[clean.length - 1].end) continue
    clean.push(marker)
  }

  for (const marker of clean) {
    if (marker.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, marker.index) })
    parts.push({ type: marker.type, value: marker.value })
    lastIndex = marker.end
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
      sx={{ display: 'flex', flexDirection: 'row', mt: 0.75, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: isMine ? 'rgba(255,255,255,0.25)' : WINDOW_BORDER, textDecoration: 'none', color: 'inherit', maxWidth: 360, '&:hover': { opacity: 0.9 } }}>
      {image && (
        <Box sx={{ width: 100, minHeight: 80, bgcolor: isMine ? 'rgba(255,255,255,0.08)' : BONE, flexShrink: 0, overflow: 'hidden' }}>
          <Box component="img" src={image} alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e: any) => { e.target.style.display = 'none' }} />
        </Box>
      )}
      <Box sx={{ p: 1, flex: 1, minWidth: 0, opacity: failed ? 0.6 : 1 }}>
        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.3, fontSize: 12, color: isMine ? WHITE : INK }} noWrap>{title}</Typography>
        {description && (
          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3, mt: 0.25, fontSize: 11, color: isMine ? 'rgba(255,255,255,0.75)' : MIST }} noWrap>{description}</Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontSize: 10, color: isMine ? 'rgba(255,255,255,0.75)' : MIST }} noWrap>{hostname}</Typography>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<any | null>(null)
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState<any | null>(null)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [memberReads, setMemberReads] = useState<any[]>([])

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

    // Re-join active channel on socket (re)connect
    const handleConnect = () => {
      if (activeChannel) socket.emit('chat:join', activeChannel)
    }
    socket.on('connect', handleConnect)

    // After a genuine reconnect, re-fetch unread + messages so nothing is stale
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

    // Presence snapshot restores online state for every member after (re)connect
    const handlePresenceSnapshot = (data: { onlineUserIds: string[] }) => {
      setOnlineUsers(new Set(data.onlineUserIds || []))
    }
    socket.on('presence:snapshot', handlePresenceSnapshot)

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

    // Live read receipts: another member read the channel — update the seen-by list
    const handleRead = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== activeChannel || data.userId === currentUserId) return
      setMemberReads(prev => {
        const existing = prev.find(r => r.user_id === data.userId)
        if (existing) {
          return prev.map(r => r.user_id === data.userId ? { ...r, last_read_at: new Date().toISOString() } : r)
        }
        return [...prev, { user_id: data.userId, last_read_at: new Date().toISOString() }]
      })
    }
    socket.on('chat:read', handleRead)

    // A member left (or was removed) — drop their typing indicator and presence
    const handleMemberLeft = (data: { channelId: string; userId: string }) => {
      setTypingUsers(prev => prev[data.channelId]
        ? { ...prev, [data.channelId]: prev[data.channelId].filter(t => t.userId !== data.userId) }
        : prev)
      if (activeChannel === data.channelId) loadChannelMembers(activeChannel)
    }
    socket.on('chat:member_left', handleMemberLeft)

    const handleFileAdded = (data: { channelId: string }) => {
      if (activeChannel && data.channelId === activeChannel) {
        loadSharedFiles(activeChannel)
      }
    }
    socket.on('chat:file_added', handleFileAdded)

    const handleMessageUpdated = (msg: any) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m))
      if (activeChannel && msg.channel_id === activeChannel) {
        setChannels(prev => prev.map(c => c.id === msg.channel_id ? { ...c, last_message: msg.content || c.last_message } : c))
      }
    }
    const handleMessageDeleted = (data: { channelId: string; messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId))
      if (activeChannel && data.channelId === activeChannel) {
        loadChannels()
      }
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

  // Debounced message search across member channels
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/chat/search', { params: { q } })
        setSearchResults(res.data || [])
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
    return () => { clearTimeout(timer); setSearching(false) }
  }, [searchQuery])

  const isSearching = searchQuery.trim().length > 0

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

  const startEditing = (msg: any) => {
    setEditingMessageId(msg.id)
    setEditText(msg.content || '')
  }

  const saveEdit = async (msg: any) => {
    if (!editText.trim() || editText === msg.content) { setEditingMessageId(null); return }
    try {
      const res = await api.patch(`/chat/channels/${msg.channel_id}/messages/${msg.id}`, { content: editText.trim() })
      setMessages(prev => prev.map(m => m.id === res.data.id ? { ...m, ...res.data } : m))
      setEditingMessageId(null)
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to edit message')
    }
  }

  const confirmDeleteMessage = async () => {
    if (!deleteConfirmMsg) return
    try {
      await api.delete(`/chat/channels/${deleteConfirmMsg.channel_id}/messages/${deleteConfirmMsg.id}`)
      setMessages(prev => prev.filter(m => m.id !== deleteConfirmMsg.id))
      loadChannels()
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to delete message')
    }
    setDeleteConfirmMsg(null)
  }

  const handleToggleReaction = async (msg: any, emoji: string) => {
    try {
      const res = await api.post(`/chat/channels/${msg.channel_id}/messages/${msg.id}/reactions`, { emoji })
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: res.data.reactions } : m))
    } catch { /* ignore */ }
    setReactionPickerFor(null)
    setReactionPickerAnchor(null)
  }

  const openReactionPicker = (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation()
    setReactionPickerFor(msgId)
    setReactionPickerAnchor(e.currentTarget)
  }

  const handleLeaveGroup = async () => {
    if (!activeChannel) return
    try {
      await api.delete(`/chat/channels/${activeChannel}/leave`)
      const removedId = activeChannel
      setChannels(prev => prev.filter(c => c.id !== removedId))
      const remaining = channels.filter(c => c.id !== removedId)
      setActiveChannel(remaining.length > 0 ? remaining[0].id : null)
      setActiveTab(0)
      setLeaveConfirmOpen(false)
      setShowMembers(false)
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
    if (activeChannelType === 'dm') {
      if (!otherLastRead) return false
      return new Date(msg.created_at) <= new Date(otherLastRead)
    }
    // Group/general channels: seen by any other member who has read past this message
    if (!memberReads.length) return false
    return memberReads.some(r => r.last_read_at && new Date(msg.created_at) <= new Date(r.last_read_at))
  }

  const getSeenByNames = (msg: any) => {
    if (activeChannelType === 'dm') return 'Seen'
    const readers = memberReads
      .filter(r => r.last_read_at && new Date(msg.created_at) <= new Date(r.last_read_at))
      .map(r => `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email?.split('@')[0] || 'Someone')
    return readers.length > 0 ? `Seen by ${readers.join(', ')}` : 'Seen'
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

  const channelAvatarSx = { bgcolor: BONE, border: `1px solid ${HAIRLINE}`, color: NAVY }
  const ownAvatarSx = { bgcolor: NAVY, color: WHITE, border: `1px solid ${NAVY_DEEP}` }

  const SidebarSection = ({ title, sectionKey, icon, items, avatarFn, nameFn }: any) => (
    <>
      <ListItemButton dense sx={{ px: 2, py: 0.75 }} onClick={() => toggleSection(sectionKey)}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ width: '100%' }}>
          {icon}
          <Typography variant="caption" fontWeight={800} sx={{ flex: 1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: MIST }}>{title}</Typography>
          {items.length > 0 && (
            <Typography variant="caption" sx={{ fontSize: 10.5, fontWeight: 700, color: MIST }}>{items.length}</Typography>
          )}
          {expandedSections[sectionKey] ? <ExpandLessIcon sx={{ fontSize: 16, color: MIST }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: MIST }} />}
        </Stack>
      </ListItemButton>
      {expandedSections[sectionKey] && items.map((ch: any) => {
        const { initials, avatar } = avatarFn(ch)
        const isDM = ch.type === 'dm'
        const otherUserId = isDM && ch.members ? ch.members.find((m: any) => m.user_id !== currentUserId)?.user_id : null
        const isOnline = otherUserId && onlineUsers.has(otherUserId)
        const onlineCount = ch.type === 'general' || ch.type === 'group' ? getOnlineCount(ch) : 0
        const isActive = activeChannel === ch.id
        const unread = ch.unread_count > 0 && !isActive
        return (
          <ListItemButton key={ch.id}
            selected={isActive}
            onClick={() => { setActiveChannel(ch.id); setActiveTab(0) }}
            sx={{
              borderRadius: 1, mx: 0.75, my: 0.25, py: 0.75, px: 1,
              '&.Mui-selected': { bgcolor: BONE, '&:hover': { bgcolor: BONE } },
            }}
          >
            <ListItemAvatar sx={{ minWidth: 36 }}>
              <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={isDM && isOnline ? <Box sx={{ width: 10, height: 10, bgcolor: EMERALD, borderRadius: '50%', border: `2px solid ${CHROME}` }} /> : null}>
                <Avatar src={avatar || undefined} sx={{ width: 32, height: 32, fontSize: 12, bgcolor: ch.type === 'general' ? NAVY : BONE, color: ch.type === 'general' ? WHITE : NAVY, border: `1px solid ${ch.type === 'general' ? NAVY_DEEP : HAIRLINE}` }}>
                  {initials}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography variant="body2" fontWeight={isActive ? 800 : unread ? 700 : 500} noWrap sx={{ fontSize: 13.5, color: isActive ? NAVY : INK }}>{nameFn(ch)}</Typography>
                  {isDM && isOnline && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: EMERALD, flexShrink: 0 }} />}
                  {(ch.type === 'general' || ch.type === 'group') && onlineCount > 0 && (
                    <Typography variant="caption" sx={{ fontSize: 10, color: MIST, fontWeight: 500 }}>{onlineCount} online</Typography>
                  )}
                </Stack>
              }
              secondary={ch.last_message ? ch.last_message.substring(0, 26) + (ch.last_message.length > 26 ? '...' : '') : 'No messages yet'}
              secondaryTypographyProps={{ fontSize: 11.5, noWrap: true, color: unread ? INK : MIST, fontWeight: unread ? 600 : 400 }}
            />
            <Stack alignItems="flex-end" spacing={0.5} sx={{ ml: 0.5 }}>
              {ch.last_message_at && (
                <Typography variant="caption" sx={{ fontSize: 10, color: MIST, whiteSpace: 'nowrap' }}>
                  {timeAgo(ch.last_message_at)}
                </Typography>
              )}
              {unread && (
                <Box sx={{ minWidth: 18, height: 18, borderRadius: '50%', bgcolor: EMERALD_DEEP, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>{ch.unread_count > 99 ? '99+' : ch.unread_count}</Typography>
                </Box>
              )}
            </Stack>
          </ListItemButton>
        )
      })}
    </>
  )

  return (
    <Box className="chat-root" sx={{ display: 'flex', height: 'calc(100vh - 112px)', gap: 0, overflow: 'hidden', bgcolor: BONE, p: { xs: 0, md: 1.5 }, boxSizing: 'border-box' }}>
      {/* Reveal message action buttons on hover + one authored motion (typing pulse) */}
      <style>{`
        .message-group:hover .msg-actions, .message-group:focus-within .msg-actions { opacity: 1 !important; }
        .chat-root *:focus-visible { outline: 2px solid ${EMERALD}; outline-offset: 2px; border-radius: 4px; }
        @keyframes chatTypingPulse { 0%, 100% { opacity: 0.35; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        .chat-typing-dot { animation: chatTypingPulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .chat-typing-dot { animation: none; opacity: 1; transform: none; } }
      `}</style>

      {/* Framed window */}
      <Paper elevation={0} sx={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden', borderRadius: { xs: 0, md: 3 }, border: { xs: 'none', md: `1px solid ${WINDOW_BORDER}` }, boxShadow: { xs: 'none', md: WINDOW_SHADOW } }}>

      {/* Sidebar */}
      {drawerOpen && (
        <Paper sx={{ width: 300, minWidth: 300, display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', borderRight: `1px solid ${HAIRLINE}`, bgcolor: CHROME }} elevation={0}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: CHROME }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: NAVY, flexShrink: 0 }} />
                <Typography variant="h6" fontWeight={900} sx={{ fontSize: 18, color: INK, letterSpacing: '-0.02em' }}>Chat</Typography>
                {totalUnread > 0 && (
                  <Box sx={{ minWidth: 20, height: 20, borderRadius: '50%', bgcolor: EMERALD_DEEP, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{totalUnread > 99 ? '99+' : totalUnread}</Typography>
                  </Box>
                )}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <Button size="small" onClick={() => setDmDialog(true)}
                  startIcon={<PersonIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: NAVY, fontWeight: 700, fontSize: 12, textTransform: 'none', px: 1, '&:hover': { bgcolor: BONE } }}>
                  New message
                </Button>
                <Button size="small" onClick={() => setGroupDialog(true)}
                  startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: NAVY, fontWeight: 700, fontSize: 12, textTransform: 'none', px: 1, '&:hover': { bgcolor: BONE } }}>
                  New group
                </Button>
              </Stack>
            </Stack>
            <TextField size="small" placeholder="Search conversations" fullWidth
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              InputProps={{
                endAdornment: searchQuery ? (
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearchQuery('')}><CloseIcon sx={{ fontSize: 16, color: MIST }} /></IconButton>
                ) : undefined,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, fontSize: 13 }, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }} />
          </Box>
          <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
            {isSearching ? (
              <>
                {searching ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={22} sx={{ color: NAVY }} /></Box>
                ) : searchResults.length > 0 ? (
                  <>
                    <Typography variant="caption" sx={{ display: 'block', px: 2, py: 0.5, fontWeight: 800, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.08em', color: MIST }}>
                      Message results
                    </Typography>
                    {searchResults.map((r: any) => {
                      const rIsMine = r.sender_id === currentUserId
                      const rName = rIsMine ? 'You' : `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email?.split('@')[0] || 'Unknown'
                      return (
                        <ListItemButton key={r.id} dense
                          onClick={() => { setActiveChannel(r.channel_id); setActiveTab(0); setSearchQuery(''); setSearchResults([]) }}
                          sx={{ borderRadius: 1, mx: 0.75, my: 0.25, py: 0.5 }}>
                          <ListItemText
                            primary={<Stack direction="row" spacing={0.75} alignItems="center"><Chip label={r.channel_name || 'Channel'} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(15,76,129,0.08)', color: NAVY, fontWeight: 700 }} /><Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 12.5, color: INK }}>{rName}</Typography></Stack>}
                            secondary={<Typography variant="caption" sx={{ fontSize: 11.5, color: MIST }} noWrap>{r.content?.substring(0, 60) || (r.file_name ? '📎 ' + r.file_name : '')}</Typography>}
                            secondaryTypographyProps={{ component: 'div' }} />
                          <Typography variant="caption" sx={{ fontSize: 10, color: MIST, whiteSpace: 'nowrap' }}>{timeAgo(r.created_at)}</Typography>
                        </ListItemButton>
                      )
                    })}
                  </>
                ) : (
                  <Typography sx={{ p: 2, textAlign: 'center', fontSize: 13, color: MIST }}>No messages match your search</Typography>
                )}
              </>
            ) : (
              <>
                {generalChannels.length > 0 && <SidebarSection title="General" sectionKey="general" icon={<TagIcon sx={{ fontSize: 16, color: NAVY }} />} items={generalChannels} avatarFn={() => ({ initials: '#', avatar: '' })} nameFn={(ch: any) => ch.name} />}
                {groupChannels.length > 0 && <><Box sx={{ mx: 2, borderTop: `1px solid ${HAIRLINE}`, my: 1 }} /><SidebarSection title="Groups" sectionKey="groups" icon={<GroupsIcon sx={{ fontSize: 16, color: NAVY }} />} items={groupChannels} avatarFn={(ch: any) => ({ initials: ch.name?.[0]?.toUpperCase() || 'G', avatar: '' })} nameFn={(ch: any) => ch.name} /></>}
                {dmChannels.length > 0 && <><Box sx={{ mx: 2, borderTop: `1px solid ${HAIRLINE}`, my: 1 }} /><SidebarSection title="Direct messages" sectionKey="dms" icon={<ForumIcon sx={{ fontSize: 16, color: NAVY }} />} items={dmChannels} avatarFn={getChannelAvatar} nameFn={getChannelName} /></>}
                {channels.length === 0 && (
                  <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: EMERALD, mx: 'auto', mb: 1.5 }} />
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK }}>No conversations yet</Typography>
                    <Typography sx={{ fontSize: 12, color: MIST, mt: 0.5, lineHeight: 1.5 }}>Start a direct message or create a group for your team.</Typography>
                  </Box>
                )}
              </>
            )}
          </List>
        </Paper>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: WHITE }}>
        {/* Header */}
        <Paper sx={{ px: 2.5, py: 1.5, borderRadius: 0, border: 'none', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: CHROME }} elevation={0}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {!drawerOpen && <IconButton size="small" aria-label="Open channel list" onClick={() => setDrawerOpen(true)}><ArrowBackIcon sx={{ color: NAVY }} /></IconButton>}
            {activeChannelType === 'general' || activeChannelType === 'group' ? (
              <Avatar sx={{ bgcolor: activeChannelType === 'general' ? NAVY : BONE, color: activeChannelType === 'general' ? WHITE : NAVY, border: `1px solid ${activeChannelType === 'general' ? NAVY_DEEP : HAIRLINE}`, width: 38, height: 38, fontSize: 15 }}>
                {activeChannelType === 'general' ? '#' : activeChannelName?.[0]?.toUpperCase() || 'C'}
              </Avatar>
            ) : (
              <Avatar src={activeChannelData ? getChannelAvatar(activeChannelData).avatar || undefined : undefined}
                sx={{ bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}`, width: 38, height: 38, fontSize: 15 }}>
                {activeChannelData ? getChannelAvatar(activeChannelData).initials : '?'}
              </Avatar>
            )}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={800} sx={{ lineHeight: 1.2, fontSize: 15, color: INK }}>{activeChannelName || 'Select a conversation'}</Typography>
                {(activeChannelType === 'general' || activeChannelType === 'group') && getOnlineCount(activeChannelData) > 0 && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: MIST }}>{getOnlineCount(activeChannelData)} online</Typography>
                  </Stack>
                )}
                {activeChannelType === 'dm' && onlineUsers.has(channelMembers.find((m: any) => m.user_id !== currentUserId)?.user_id) && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: MIST }}>Online</Typography>
                  </Stack>
                )}
              </Stack>
              <Typography variant="caption" sx={{ fontSize: 11.5, color: MIST }}>
                {activeChannelType === 'general' ? 'General channel' : activeChannelType === 'group' ? `${channelMembers.length} members` : activeChannelType === 'dm' ? 'Direct message' : ''}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {(activeChannelType === 'group' || activeChannelType === 'general') && channelMembers.length > 0 && (
              <Stack direction="row" spacing={-0.75} alignItems="center" sx={{ mr: 1 }}>
                {channelMembers.slice(0, 6).map((m: any, i: number) => (
                  <Tooltip key={m.user_id} title={`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: BONE, color: NAVY, border: `2px solid ${CHROME}`, ml: i === 0 ? 0 : -0.75, zIndex: 6 - i }}>
                      {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
                {channelMembers.length > 6 && (
                  <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: NAVY, color: WHITE, border: `2px solid ${CHROME}`, ml: -0.75, zIndex: 0 }}>
                    +{channelMembers.length - 6}
                  </Avatar>
                )}
              </Stack>
            )}
            {/* Only show View Members for groups/general, NOT DMs */}
            {activeChannelType !== 'dm' && (
              <Tooltip title="View Members">
                <IconButton size="small" aria-label="View members" onClick={() => { setShowMembers(true); loadChannelMembers(activeChannel!) }} disabled={!activeChannel} sx={{ color: NAVY, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                  <GroupsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" aria-label="Toggle channel list" onClick={() => setDrawerOpen(prev => !prev)} sx={{ color: NAVY, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
              <ForumIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Paper>

        {/* Tab bar */}
        {activeChannel && (
          <Box sx={{ borderBottom: `1px solid ${HAIRLINE}`, bgcolor: CHROME, px: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); if (v === 1) loadSharedFiles(activeChannel!) }}
              TabIndicatorProps={{ sx: { bgcolor: EMERALD, height: 2 } }}
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none', fontWeight: 600, fontSize: 13, color: MIST, '&.Mui-selected': { color: NAVY, fontWeight: 800 } } }}>
              <Tab label="Messages" />
              <Tab label={`Files (${sharedFiles.length})`} />
            </Tabs>
          </Box>
        )}

        {/* Content */}
        {activeTab === 0 ? (
          <>
            {/* Messages */}
            <Paper ref={msgContainerRef} sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, md: 2.5 }, borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column', bgcolor: BONE }} elevation={0}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
              ) : messages.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, flexDirection: 'column', gap: 1.5, px: 3 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: EMERALD }} />
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK }}>Start the conversation</Typography>
                  <Typography sx={{ fontSize: 13, color: MIST, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>No messages yet. Send the first note to get the team talking.</Typography>
                </Box>
              ) : (() => {
                const unreadIdx = otherLastRead
                  ? messages.findIndex(msg => new Date(msg.created_at) > new Date(otherLastRead))
                  : -1
                return <>
                  {hasOlder && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => loadOlderMessages(activeChannel!)} disabled={olderLoading}
                        startIcon={olderLoading ? <CircularProgress size={14} /> : <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }} />}
                        sx={{ borderRadius: 1, fontSize: 12, textTransform: 'none', color: INK, borderColor: OUTLINE, '&:hover': { borderColor: NAVY, color: NAVY } }}>
                        {olderLoading ? 'Loading...' : 'Load earlier messages'}
                      </Button>
                    </Box>
                  )}
                {messages.map((msg, i) => {
                  const isUnreadStart = i === unreadIdx
                  const isMine = msg.sender_id === currentUserId
                  const showAvatar = i === 0 || messages[i - 1]?.sender_id !== msg.sender_id
                  const msgDate = new Date(msg.created_at)
                  const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null
                  const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString()
                  const seen = isMine && isMessageSeen(msg)
                  return (
                    <Box key={msg.id}>
                      {isUnreadStart && (
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ my: 1.5 }}>
                          <Box sx={{ flex: 1, borderTop: `1px solid rgba(16,185,129,0.45)` }} />
                          <Typography variant="caption" sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: EMERALD_DEEP }}>New messages</Typography>
                          <Box sx={{ flex: 1, borderTop: `1px solid rgba(16,185,129,0.45)` }} />
                        </Stack>
                      )}
                      {showDateDivider && (
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ my: 1.5 }}>
                          <Box sx={{ flex: 1, borderTop: `1px solid ${HAIRLINE}` }} />
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700, color: MIST }}>{formatDate(msg.created_at)}</Typography>
                          <Box sx={{ flex: 1, borderTop: `1px solid ${HAIRLINE}` }} />
                        </Stack>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 0.75 }}
                        className="message-group">
                        <Stack direction={isMine ? 'row-reverse' : 'row'} spacing={1} alignItems="flex-end" sx={{ maxWidth: '74%' }}>
                          {showAvatar ? (
                            isMine ? (
                              <Avatar src={rawUser.profile_picture_url || undefined} sx={{ width: 30, height: 30, fontSize: 12, ...ownAvatarSx }}>
                                {(rawUser.first_name?.[0] || rawUser.email?.[0] || '?').toUpperCase()}
                              </Avatar>
                            ) : (
                              <Avatar src={msg.profile_picture_url || undefined} sx={{ width: 30, height: 30, fontSize: 12, ...channelAvatarSx }}>
                                {getMemberAvatar(msg)}
                              </Avatar>
                            )
                          ) : (
                            <Box sx={{ width: 30 }} />
                          )}
                          <Box sx={{ maxWidth: '100%' }}>
                            {showAvatar && (
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.25, textAlign: isMine ? 'right' : 'left', fontWeight: 700, fontSize: 11, color: isMine ? NAVY : INK }}>
                                {isMine ? 'You' : getMemberName(msg)}
                              </Typography>
                            )}
                            {editingMessageId === msg.id ? (
                              <Stack direction="row" spacing={0.5} alignItems="flex-start">
                                <TextField size="small" fullWidth multiline maxRows={4} autoFocus
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  sx={{ bgcolor: WHITE, '& .MuiOutlinedInput-root': { borderRadius: 1, fontSize: 13.5 } }} />
                                <Stack spacing={0.5}>
                                  <IconButton size="small" aria-label="Save edit" onClick={() => saveEdit(msg)} sx={{ bgcolor: NAVY, color: WHITE, '&:hover': { bgcolor: NAVY_DEEP } }}>
                                    <CheckIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                  <IconButton size="small" aria-label="Cancel edit" onClick={() => setEditingMessageId(null)} sx={{ bgcolor: WHITE, border: `1px solid ${HAIRLINE}` }}>
                                    <CloseIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Stack>
                              </Stack>
                            ) : (
                              <Paper sx={{
                                px: msg.content ? 1.5 : 0.75, py: msg.content ? 0.75 : 0.5,
                                borderRadius: 1,
                                bgcolor: isMine ? NAVY : WHITE,
                                color: isMine ? WHITE : INK,
                                border: isMine ? 'none' : `1px solid ${HAIRLINE}`,
                                borderBottomRightRadius: isMine && !showAvatar ? 0.5 : 1,
                                borderBottomLeftRadius: !isMine && !showAvatar ? 0.5 : 1,
                                boxShadow: SEAT_SHADOW,
                                position: 'relative',
                              }} elevation={0}>
                                <Box sx={{ position: 'absolute', top: -22, right: 0, display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s' }}
                                  className="msg-actions">
                                  <IconButton size="small" title="Add reaction" aria-label="Add reaction" onClick={(e) => openReactionPicker(e, msg.id)}
                                    sx={{ width: 26, height: 26, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: SEAT_SHADOW, '&:hover': { bgcolor: BONE } }}>
                                    <MoodIcon sx={{ fontSize: 15, color: MIST }} />
                                  </IconButton>
                                  {isMine && (
                                    <>
                                      <IconButton size="small" title="Edit" aria-label="Edit message" onClick={(e) => { e.stopPropagation(); startEditing(msg) }}
                                        sx={{ width: 26, height: 26, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: SEAT_SHADOW, '&:hover': { bgcolor: BONE } }}>
                                        <TagIcon sx={{ fontSize: 14, color: MIST }} />
                                      </IconButton>
                                      <IconButton size="small" title="Delete" aria-label="Delete message" onClick={(e) => { e.stopPropagation(); setDeleteConfirmMsg(msg) }}
                                        sx={{ width: 26, height: 26, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, boxShadow: SEAT_SHADOW, '&:hover': { bgcolor: '#FDE8E8' } }}>
                                        <DeleteIcon sx={{ fontSize: 14, color: DANGER }} />
                                      </IconButton>
                                    </>
                                  )}
                                </Box>
                                {msg.content && (
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, fontSize: 13.5 }}>
                                    {renderMessageText(msg.content).map((part, i) =>
                                      part.type === 'url' ? (
                                        <Typography key={i} component="a" href={part.value} target="_blank" rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          sx={{ color: isMine ? WHITE : NAVY, textDecoration: 'underline', fontWeight: 600, '&:hover': { opacity: 0.8 } }}>
                                          {part.value}
                                        </Typography>
                                      ) : part.type === 'mention' ? (
                                        <Typography key={i} component="span"
                                          sx={{ color: isMine ? WHITE : NAVY, backgroundColor: isMine ? 'rgba(255,255,255,0.16)' : 'rgba(15,76,129,0.08)', borderRadius: 0.5, px: 0.25, fontWeight: 700 }}>
                                          {part.value}
                                        </Typography>
                                      ) : (
                                        <span key={i}>{part.value}</span>
                                      )
                                    )}
                                  </Typography>
                                )}
                                {msg.edited_at && (
                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>
                                    (edited)
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
                                            sx={{ maxWidth: 200, maxHeight: 150, borderRadius: 1, objectFit: 'cover', display: 'block', bgcolor: BONE, border: `1px solid ${HAIRLINE}` }} />
                                        ) : (
                                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ bgcolor: isMine ? 'rgba(255,255,255,0.12)' : WHITE, borderRadius: 1, p: 0.75, border: isMine ? 'none' : `1px solid ${HAIRLINE}` }}>
                                            <FileIcon sx={{ fontSize: 20, color: isMine ? WHITE : NAVY }} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: isMine ? WHITE : INK }}>
                                                {msg.file_name || 'File'}
                                              </Typography>
                                              <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, color: isMine ? WHITE : MIST }}>
                                                <OpenInNewIcon sx={{ fontSize: 12 }} /> Click to preview
                                              </Typography>
                                            </Box>
                                          </Stack>
                                        )}
                                      </Box>
                                    ) : (
                                      <Stack direction="row" spacing={0.75} alignItems="center">
                                        <AttachFileIcon sx={{ fontSize: 16, color: isMine ? 'rgba(255,255,255,0.7)' : MIST }} />
                                        <Typography variant="caption" component="a" href={msg.file_url} target="_blank" rel="noopener"
                                          sx={{ color: isMine ? WHITE : NAVY, textDecoration: 'underline', fontWeight: 600, fontSize: 12 }}>
                                          {msg.file_name || 'View file'}
                                        </Typography>
                                      </Stack>
                                    )}
                                  </Box>
                                )}
                              </Paper>
                            )}
                            {!editingMessageId && msg.reactions && msg.reactions.length > 0 && (
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                                {msg.reactions.map((r: any) => (
                                  <Chip key={r.emoji} size="small" clickable
                                    label={`${r.emoji} ${r.count}`}
                                    onClick={() => handleToggleReaction(msg, r.emoji)}
                                    sx={{ height: 22, fontSize: 12, bgcolor: r.reacted_by_me ? 'rgba(16,185,129,0.12)' : WHITE, color: r.reacted_by_me ? EMERALD_DEEP : INK, border: `1px solid ${r.reacted_by_me ? 'rgba(16,185,129,0.4)' : HAIRLINE}`, fontWeight: r.reacted_by_me ? 800 : 500, '& .MuiChip-label': { px: 0.75 } }} />
                                ))}
                              </Stack>
                            )}
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                              <Typography variant="caption" sx={{ fontSize: 10, color: MIST }}>{formatTime(msg.created_at)}</Typography>
                              {isMine && seen && (
                                <Tooltip title={getSeenByNames(msg)}>
                                  <DoneAllIcon sx={{ fontSize: 13, color: EMERALD }} />
                                </Tooltip>
                              )}
                              {isMine && !seen && msg.sender_id === currentUserId && (activeChannelType === 'dm' ? otherLastRead : memberReads.length > 0) && (
                                <CheckIcon sx={{ fontSize: 13, color: MIST }} />
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    </Box>
                  )
                })}
              </>
              })()
            }
              {typingText && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ ml: 1, mt: 0.5 }}>
                  <Box className="chat-typing-dot" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: EMERALD }} />
                  <Typography variant="caption" sx={{ fontSize: 12, color: MIST, fontStyle: 'italic' }}>{typingText}</Typography>
                </Stack>
              )}
              <div ref={messagesEndRef} />
            </Paper>

            {/* Live input link preview */}
            {inputLinkPreview && (
              <Box sx={{ px: 1.5, pt: 1.5, bgcolor: WHITE, borderTop: `1px solid ${HAIRLINE}` }}>
                <Box component="a" href={inputLinkPreview.url} target="_blank" rel="noopener noreferrer"
                  sx={{ display: 'flex', flexDirection: 'row', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${HAIRLINE}`, textDecoration: 'none', color: 'inherit', maxWidth: 360, bgcolor: WHITE, '&:hover': { opacity: 0.9 } }}>
                  {inputLinkPreview.image && (
                    <Box sx={{ width: 80, minHeight: 64, bgcolor: BONE, flexShrink: 0, overflow: 'hidden' }}>
                      <Box component="img" src={inputLinkPreview.image} alt=""
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e: any) => { e.target.style.display = 'none' }} />
                    </Box>
                  )}
                  <Box sx={{ p: 0.75, flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.3, fontSize: 11, color: INK }} noWrap>{inputLinkPreview.title}</Typography>
                    {inputLinkPreview.description && (
                      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3, mt: 0.125, fontSize: 10, color: MIST }} noWrap>{inputLinkPreview.description}</Typography>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.125, fontSize: 9, color: MIST }} noWrap>{(() => { try { return new URL(inputLinkPreview.url).hostname } catch { return inputLinkPreview.url } })()}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
            {inputLinkLoading && (
              <Box sx={{ px: 1.5, pt: 1.5, bgcolor: WHITE, borderTop: `1px solid ${HAIRLINE}` }}>
                <Typography variant="caption" sx={{ fontSize: 11, color: MIST }}>Loading preview...</Typography>
              </Box>
            )}
            {/* Input */}
            <Paper sx={{ p: 1.5, border: 'none', borderTop: `1px solid ${HAIRLINE}`, bgcolor: WHITE }} elevation={0}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <Tooltip title="Attach file">
                  <span>
                    <IconButton size="small" aria-label="Attach file" onClick={handleFileSelect} disabled={!activeChannel} sx={{ color: NAVY, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                      <AttachFileIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.length) handleSend() }} />
                <Box sx={{ position: 'relative', flex: 1 }}>
                  <TextField fullWidth size="small" multiline maxRows={3} autoFocus
                    placeholder={activeChannel ? 'Write a message...' : 'Select a conversation'}
                    value={messageText}
                    onChange={e => { setMessageText(e.target.value); handleTyping() }}
                    onKeyDown={handleKeyDown}
                    disabled={!activeChannel}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: BONE, pr: 5 }, '& .MuiOutlinedInput-notchedOutline': { border: `1px solid ${HAIRLINE}` } }}
                    InputProps={{
                      endAdornment: activeChannel && (
                        <Box sx={{ position: 'absolute', right: 8, bottom: 6 }}>
                          <IconButton size="small" aria-label="Emoji picker" onClick={() => setShowEmoji(!showEmoji)}>
                            <MoodIcon sx={{ fontSize: 20, color: showEmoji ? EMERALD : MIST }} />
                          </IconButton>
                        </Box>
                      )
                    }}
                  />
                  {showEmoji && (
                    <Paper ref={emojiRef} sx={{ position: 'absolute', bottom: '100%', right: 0, mb: 1, p: 1, maxWidth: 320, maxHeight: 200, overflow: 'auto', borderRadius: 2, border: `1px solid ${HAIRLINE}`, boxShadow: WINDOW_SHADOW, zIndex: 10 }} elevation={0}>
                      <Stack direction="row" flexWrap="wrap" spacing={0.5} useFlexGap>
                        {EMOJIS.map(e => (
                          <Typography key={e} role="button" tabIndex={0} aria-label={`Insert ${e}`} sx={{ cursor: 'pointer', fontSize: 22, lineHeight: 1.4, '&:hover': { transform: 'scale(1.3)', transition: '0.15s' } }} onClick={() => insertEmoji(e)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); insertEmoji(e) } }}>{e}</Typography>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </Box>
                <Button variant="contained" onClick={handleSend}
                  disabled={sending || (!messageText.trim() && !fileInputRef.current?.files?.length) || !activeChannel}
                  startIcon={sending ? <CircularProgress size={16} sx={{ color: WHITE }} /> : <SendIcon />}
                  sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, minWidth: 40, px: 2, borderRadius: 1, height: 40, textTransform: 'none', fontWeight: 700 }}>
                  Send
                </Button>
              </Stack>
            </Paper>
          </>
        ) : (
          /* Files tab */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: WHITE }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: 14, color: INK }}>Shared files</Typography>
                <Chip label={sharedFiles.length} size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(15,76,129,0.08)', color: NAVY, fontWeight: 700 }} />
                <IconButton size="small" aria-label="List view" onClick={() => setFilesViewMode('list')} sx={{ color: filesViewMode === 'list' ? NAVY : MIST, border: `1px solid ${filesViewMode === 'list' ? NAVY : HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                  <ViewListIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="Grid view" onClick={() => setFilesViewMode('grid')} sx={{ color: filesViewMode === 'grid' ? NAVY : MIST, border: `1px solid ${filesViewMode === 'grid' ? NAVY : HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                  <GridViewIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Button variant="outlined" size="small" component="label" startIcon={<AttachFileIcon />} disabled={uploadingFile}
                sx={{ color: NAVY, borderColor: OUTLINE, textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: NAVY } }}>
                {uploadingFile ? 'Uploading...' : 'Upload file'}
                <input type="file" ref={sharedFileInputRef} hidden onChange={handleSharedFileUpload} />
              </Button>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {filesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} sx={{ color: NAVY }} /></Box>
              ) : sharedFiles.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1, py: 6 }}>
                  <FileIcon sx={{ fontSize: 48, color: HAIRLINE }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: INK }}>No shared files yet</Typography>
                  <Typography sx={{ fontSize: 12.5, color: MIST, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>Upload documents, policies, plans, and minutes for the team.</Typography>
                </Box>
              ) : filesViewMode === 'grid' ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                  {sharedFiles.map(f => {
                    const isImage = f.file_url?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)
                    return (
                      <Paper key={f.id} variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer', position: 'relative', borderColor: WINDOW_BORDER, '&:hover': { borderColor: NAVY, '& .download-overlay': { opacity: 1 } } }} onClick={() => openFilePreview(f.file_url, f.file_name)}>
                        <Box sx={{ height: 140, bgcolor: BONE, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {isImage ? (
                            <SecureImg src={f.file_url} alt={f.file_name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <FileIcon sx={{ fontSize: 48, color: MIST }} />
                          )}
                        </Box>
                        <IconButton className="download-overlay" aria-label={`Download ${f.file_name}`}
                          onClick={(e) => { e.stopPropagation(); handleDownload(f.file_url, f.file_name) }}
                          sx={{ position: 'absolute', top: 4, right: 4, bgcolor: WHITE, border: `1px solid ${HAIRLINE}`, opacity: 0, transition: 'opacity 0.2s', '&:hover': { bgcolor: BONE } }}>
                          <DownloadIcon fontSize="small" sx={{ color: NAVY }} />
                        </IconButton>
                        <Box sx={{ p: 1.25 }}>
                          <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: 13, color: INK }}>{f.file_name}</Typography>
                          <Typography variant="caption" sx={{ fontSize: 11, display: 'block', color: MIST }}>
                            {`${f.first_name || ''} ${f.last_name || ''}`.trim() || f.email || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: 10, color: MIST }}>
                            {f.file_size ? formatFileSize(f.file_size) : ''}{f.file_size && f.created_at ? ' · ' : ''}{f.created_at ? formatDate(f.created_at) : ''}
                          </Typography>
                        </Box>
                      </Paper>
                    )
                  })}
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderColor: WINDOW_BORDER }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: BONE }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12, color: INK }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12, color: INK }}>Uploaded by</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12, color: INK }}>Size</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12, color: INK }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12, color: INK }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sharedFiles.map(f => (
                        <TableRow key={f.id} hover sx={{ '&:hover': { bgcolor: BONE } }}>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FileIcon sx={{ fontSize: 20, color: NAVY }} />
                              <Typography variant="body2" component="a" onClick={() => openFilePreview(f.file_url, f.file_name)}
                                sx={{ color: NAVY, textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}>
                                {f.file_name}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ color: INK }}>{`${f.first_name || ''} ${f.last_name || ''}`.trim() || f.email}</TableCell>
                          <TableCell sx={{ color: MIST }}>{f.file_size ? formatFileSize(f.file_size) : '—'}</TableCell>
                          <TableCell sx={{ color: MIST }}>{formatDate(f.created_at)}</TableCell>
                          <TableCell>
                            <IconButton size="small" aria-label={`Download ${f.file_name}`} onClick={() => handleDownload(f.file_url, f.file_name)}>
                              <DownloadIcon fontSize="small" sx={{ color: NAVY }} />
                            </IconButton>
                            <IconButton size="small" color="error" aria-label={`Delete ${f.file_name}`} onClick={() => handleDeleteSharedFile(f.id)}>
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
      </Paper>

      {/* File Preview Dialog */}
      <Dialog open={!!filePreview} onClose={() => { if (filePreview?.url.startsWith('blob:')) URL.revokeObjectURL(filePreview.url); setFilePreview(null); setFileTextContent(null) }} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: CHROME, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FileIcon sx={{ color: NAVY }} />
            <Typography variant="h6" fontWeight={800} sx={{ fontSize: 16, color: INK }}>{filePreview?.name || 'File Preview'}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton component="a" href={filePreview?.url} download={filePreview?.name} aria-label="Download"><DownloadIcon sx={{ color: NAVY }} /></IconButton>
            <IconButton onClick={() => { if (filePreview?.url.startsWith('blob:')) URL.revokeObjectURL(filePreview.url); setFilePreview(null); setFileTextContent(null) }} aria-label="Close preview">
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: BONE }}>
          {filePreview?.type === 'application/pdf' ? (
            <Box sx={{ width: '100%', height: '70vh' }}>
              <iframe src={filePreview.url} title={filePreview.name} width="100%" height="100%" style={{ border: 'none' }} />
            </Box>
          ) : filePreview?.type.startsWith('image/') ? (
            <Box component="img" src={filePreview.url} alt={filePreview.name}
              sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }} />
          ) : fileTextContent !== null ? (
            <Box sx={{ width: '100%', height: '70vh', overflow: 'auto', bgcolor: INK, borderRadius: 1, p: 2 }}>
              <pre style={{ color: '#E5E7EB', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '"Fira Code","Consolas","Monaco","Courier New",monospace', fontSize: 13, lineHeight: 1.5 }}>
                {fileTextContent}
              </pre>
            </Box>
          ) : (
            <Stack spacing={2} alignItems="center">
              <FileIcon sx={{ fontSize: 64, color: MIST }} />
              <Typography sx={{ color: MIST }}>Preview not available for this file type</Typography>
              <Button variant="contained" component="a" href={filePreview?.url} download={filePreview?.name} startIcon={<DownloadIcon />} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP } }}>
                Download
              </Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={groupDialog} onClose={() => setGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, bgcolor: CHROME, borderBottom: `1px solid ${HAIRLINE}`, fontSize: 16, color: INK }}>Create group</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <TextField label="Group name" fullWidth size="small" value={groupName} onChange={e => setGroupName(e.target.value)} helperText="Give your group a descriptive name" />
            <Autocomplete multiple options={orgMembers.filter(m => m.id !== currentUserId)}
              getOptionLabel={(o) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              value={groupMembers} onChange={(_, v) => setGroupMembers(v)}
              renderInput={(params) => <TextField {...params} label="Add members" size="small" helperText="Select team members to add" />}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>{(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}</Avatar>
                    <Box><Typography variant="body2" fontWeight={600} sx={{ color: INK }}>{`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}</Typography><Typography variant="caption" sx={{ color: MIST }}>{option.role}</Typography></Box>
                  </Stack>
                </li>
              )} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setGroupDialog(false)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" disabled={groupCreating || !groupName.trim()} onClick={handleCreateGroup} sx={{ bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP }, fontWeight: 700 }}>
            {groupCreating ? 'Creating...' : 'Create group'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DM Dialog */}
      <Dialog open={dmDialog} onClose={() => setDmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, bgcolor: CHROME, borderBottom: `1px solid ${HAIRLINE}`, fontSize: 16, color: INK }}>New message</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: MIST }}>Select a colleague to start a direct conversation</Typography>
            <Autocomplete options={orgMembers.filter(m => m.id !== currentUserId)}
              getOptionLabel={(o) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              onChange={(_, v) => { if (v) handleStartDM(v.id) }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}` }}>{(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}</Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600} sx={{ color: INK }}>{`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}</Typography>
                      <Typography variant="caption" sx={{ color: MIST }}>{option.role}</Typography>
                    </Box>
                    {onlineUsers.has(option.id) && <Chip label="Online" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(16,185,129,0.12)', color: EMERALD_DEEP, fontWeight: 700 }} />}
                  </Stack>
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Search staff" size="small" autoFocus />} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDmDialog(false)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Members Dialog - only for groups/general */}
      <Dialog open={showMembers} onClose={() => setShowMembers(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, bgcolor: CHROME, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupsIcon sx={{ color: NAVY }} /><Typography variant="h6" fontWeight={800} sx={{ fontSize: 16, color: INK }}>{activeChannelName}</Typography>
            <Chip label={`${channelMembers.length} members`} size="small" sx={{ ml: 1, bgcolor: 'rgba(15,76,129,0.08)', color: NAVY, fontWeight: 700, fontSize: 11 }} />
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List sx={{ py: 0 }}>
            {channelMembers.map((m: any) => (
              <ListItemButton key={m.user_id} sx={{ borderRadius: 0, px: 3, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}
                onContextMenu={(e) => { e.preventDefault(); setMemberMenu({ anchorEl: e.currentTarget, member: m }) }}>
                <ListItemAvatar>
                  <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={onlineUsers.has(m.user_id) ? <Box sx={{ width: 10, height: 10, bgcolor: EMERALD, borderRadius: '50%', border: `2px solid ${WHITE}` }} /> : null}>
                    <Avatar sx={{ width: 38, height: 38, fontSize: 14, bgcolor: m.user_id === currentUserId ? NAVY : BONE, color: m.user_id === currentUserId ? WHITE : NAVY, border: `1px solid ${m.user_id === currentUserId ? NAVY_DEEP : HAIRLINE}` }}>
                      {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={<Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={700} sx={{ fontSize: 14, color: INK }}>{`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}</Typography>{onlineUsers.has(m.user_id) && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: EMERALD }} />}</Stack>}
                  secondary={m.user_id === currentUserId ? 'You · ' + m.role : m.role}
                  secondaryTypographyProps={{ fontSize: 12, sx: { color: MIST } }} />
                {m.user_id !== currentUserId && (
                  <Tooltip title="Send message">
                    <IconButton size="small" aria-label={`Send message to ${`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}`} onClick={(e) => { e.stopPropagation(); handleStartDM(m.user_id); setShowMembers(false) }} sx={{ color: NAVY, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                      <ForumIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          {activeChannelType === 'group' && (
            <Button onClick={() => { setShowMembers(false); setLeaveConfirmOpen(true) }} size="small" sx={{ color: DANGER, fontWeight: 700 }}>
              Leave group
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setShowMembers(false)} sx={{ color: MIST, fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Member context menu */}
      <Menu anchorEl={memberMenu?.anchorEl} open={!!memberMenu} onClose={() => setMemberMenu(null)}
        slotProps={{ paper: { sx: { border: `1px solid ${HAIRLINE}`, boxShadow: WINDOW_SHADOW } } }}>
        <MenuItem onClick={() => { if (memberMenu) { handleStartDM(memberMenu.member.user_id); setShowMembers(false); setMemberMenu(null) } }}>
          <ForumIcon sx={{ mr: 1, fontSize: 18, color: NAVY }} /> Send message
        </MenuItem>
        {memberMenu?.member?.user_id !== currentUserId && activeChannelType !== 'dm' && (
          <MenuItem onClick={() => { setRemoveConfirm(memberMenu!.member.user_id); setMemberMenu(null) }} sx={{ color: DANGER }}>
            <CloseIcon sx={{ mr: 1, fontSize: 18 }} /> Remove from group
          </MenuItem>
        )}
      </Menu>

      {/* Reaction picker */}
      <Menu anchorEl={reactionPickerAnchor} open={!!reactionPickerFor} onClose={() => { setReactionPickerFor(null); setReactionPickerAnchor(null) }}
        slotProps={{ paper: { sx: { maxWidth: 260, p: 0.75, borderRadius: 2, border: `1px solid ${HAIRLINE}`, boxShadow: WINDOW_SHADOW } } }}>
        <Stack direction="row" flexWrap="wrap" spacing={0.25} useFlexGap sx={{ maxHeight: 160, overflow: 'auto' }}>
          {EMOJIS.map(e => (
            <Typography key={e} role="button" tabIndex={0} aria-label={`React with ${e}`} sx={{ cursor: 'pointer', fontSize: 20, lineHeight: 1.4, '&:hover': { transform: 'scale(1.3)', transition: '0.12s' } }}
              onClick={() => { if (reactionPickerFor) { const msg = messages.find(m => m.id === reactionPickerFor); if (msg) handleToggleReaction(msg, e) } }}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (reactionPickerFor) { const msg = messages.find(m => m.id === reactionPickerFor); if (msg) handleToggleReaction(msg, e) } } }}>
              {e}
            </Typography>
          ))}
        </Stack>
      </Menu>

      {/* Delete message confirm */}
      <Dialog open={!!deleteConfirmMsg} onClose={() => setDeleteConfirmMsg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: INK }}>Delete message</DialogTitle>
        <DialogContent><Alert severity="warning">Delete this message for everyone? This cannot be undone.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmMsg(null)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteMessage}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Leave group confirm */}
      <Dialog open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: INK }}>Leave group</DialogTitle>
        <DialogContent><Alert severity="warning">Are you sure you want to leave this group? You will no longer see its messages.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveConfirmOpen(false)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleLeaveGroup}>Leave</Button>
        </DialogActions>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeConfirm} onClose={() => setRemoveConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: INK }}>Remove member</DialogTitle>
        <DialogContent><Alert severity="warning">Are you sure you want to remove this member from the group?</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveConfirm(null)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
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
