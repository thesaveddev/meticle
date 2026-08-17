export const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"])/gi
const MENTION_REGEX = /(^|[\s(])(@[A-Za-z0-9][A-Za-z0-9 .'\-]*)/gi

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const pad = (n: number) => n.toString().padStart(2, '0')

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return formatDate(dateStr)
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type MessagePart = { type: 'text' | 'url' | 'mention'; value: string }

export function renderMessageText(text: string): MessagePart[] {
  const markers: { index: number; end: number; type: 'url' | 'mention'; value: string }[] = []

  const urlRe = new RegExp(URL_REGEX.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    markers.push({ index: m.index, end: m.index + m[0].length, type: 'url', value: m[0] })
  }

  const mentionRe = new RegExp(MENTION_REGEX.source, 'gi')
  while ((m = mentionRe.exec(text)) !== null) {
    const prefix = m[1]
    const start = m.index + prefix.length
    markers.push({ index: start, end: start + m[2].length, type: 'mention', value: m[2] })
  }

  markers.sort((a, b) => a.index - b.index)

  const clean: typeof markers = []
  for (const marker of markers) {
    if (clean.length > 0 && marker.index < clean[clean.length - 1].end) continue
    clean.push(marker)
  }

  const parts: MessagePart[] = []
  let last = 0
  for (const marker of clean) {
    if (marker.index > last) parts.push({ type: 'text', value: text.slice(last, marker.index) })
    parts.push({ type: marker.type, value: marker.value })
    last = marker.end
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })

  return parts
}

export const FILE_PREVIEW_TYPES = new Set([
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'image/bmp','image/tiff','application/pdf','text/plain','text/html',
  'text/csv','text/javascript','application/json','application/xml','text/xml',
])

export const EMOJIS = [
  '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘',
  '😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶',
  '😏','😒','🙄','😬','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯',
  '🥳','😎','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢',
  '😭','😱','😖','😣','😞','😓','😩','😫','😤','😡','😠','🤬','👋','✋','👌','🤌',
  '👍','👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','🙏','💪','❤️','🧡','💛','💚',
  '💙','💜','🖤','🤍','🤎','💔','🔥','⭐','🌟','✨','💯','✅','❌','❗','❓','💬',
  '📁','📂','📎','🔗','🎉','🎊','🎈','🚀','📌','🎯',
]

export function getChannelName(ch: any, currentUserId: string): string {
  if (ch.type === 'dm' && ch.members) {
    const other = ch.members.find((m: any) => m.user_id !== currentUserId)
    if (other) return `${other.first_name || ''} ${other.last_name || ''}`.trim() || other.email?.split('@')[0] || 'Unknown'
  }
  return ch.name
}

export function getChannelAvatar(ch: any, currentUserId: string): { initials: string; avatar: string } {
  if (ch.type === 'dm' && ch.members) {
    const other = ch.members.find((m: any) => m.user_id !== currentUserId)
    if (other) return { initials: (other.first_name?.[0] || other.email?.[0] || '?').toUpperCase(), avatar: other.profile_picture_url || '' }
  }
  return { initials: ch.type === 'general' ? '#' : ch.name?.[0]?.toUpperCase() || 'G', avatar: '' }
}

export function getMemberName(msg: any): string {
  return `${msg.first_name || ''} ${msg.last_name || ''}`.trim() || msg.email?.split('@')[0] || 'Unknown'
}

export function getMemberInitial(msg: any): string {
  return (msg.first_name?.[0] || msg.email?.[0] || '?').toUpperCase()
}

export function getCurrentUser(): { id: string; first_name?: string; last_name?: string; email?: string; profile_picture_url?: string } {
  try {
    const s = localStorage.getItem('user')
    const p = s ? JSON.parse(s) : null
    return p && typeof p === 'object' && p.id ? p : { id: '' }
  } catch { return { id: '' } }
}

export const NAVY = '#0F4C81'
export const NAVY_DEEP = '#0A3A63'
export const EMERALD = '#10B981'
export const EMERALD_DEEP = '#047857'
export const INK = '#1B2430'
export const MIST = '#5B6672'
export const BONE = '#F7F4EE'
export const HAIRLINE = '#E7E1D6'
export const WHITE = '#FFFFFF'
export const OUTLINE = '#D1D5DB'
export const WINDOW_BORDER = '#D1D5DB'
export const DANGER = '#DC2626'
