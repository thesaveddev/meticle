import { MICA_RECORD_PARAMS } from '@meticle/shared'
import { NOTICE_COLORS } from '../../theme/noticeTokens'
import { P } from '../../styles/tokens'

export const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"])/gi
const MENTION_REGEX = /(^|[\s(])(@[A-Za-z0-9][A-Za-z0-9 .'\-]*)/gi
/** A path in a message: everything up to whitespace or a tag/quote character. */
const RECORD_PATH_REGEX = /(^|[\s(\[<"'`])(\/[^\s<>"'`]*)/g

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

export type MessagePart = { type: 'text' | 'url' | 'mention' | 'record'; value: string }

/**
 * The record links a message body can carry, and how they are found.
 *
 * A colleague shares what the app gave them — the link from a notification, the
 * button's target from an email, the path Mica read back — and until now that was
 * dead text in chat: `/tasks?task=<id>` is not an `https://` URL, so the URL pass
 * left it alone, and a reader had to select it, copy it and paste it into the
 * address bar. This finds it instead, so a message can open the record it is about.
 *
 * The parameter names are taken from the shared contract (`MICA_RECORD_PARAMS`),
 * never restated: a kind added there is recognised here without an edit, and no
 * message can be read as a record link by a name the pages do not use. An empty
 * value is not a link — `/tasks?task=` names no record, and treating it as one
 * would navigate the reader to the tasks list with a silent no-op.
 *
 * `incident` is the one kind whose link carries no parameter at all: `micaRecordPath`
 * builds `/incidents/<id>` and the route names the record, so this is the one shape
 * checked by path. `recordLinks.test.tsx` holds this prefix to that link.
 */
const RECORD_PARAM_NAMES: readonly string[] = Object.values(MICA_RECORD_PARAMS)
const INCIDENT_PATH_PREFIX = '/incidents/'

/** True when a path names a record one of the app's pages can open. */
export function isRecordLink(path: string): boolean {
  if (!path.startsWith('/')) return false
  const [pathname, query = ''] = path.split('?', 2)
  if (pathname.startsWith(INCIDENT_PATH_PREFIX)) {
    const id = pathname.slice(INCIDENT_PATH_PREFIX.length)
    return id.length > 0 && !id.includes('/')
  }
  const params = new URLSearchParams(query)
  return RECORD_PARAM_NAMES.some(name => Boolean(params.get(name)))
}

/**
 * The record link a token holds, or null — trailing sentence punctuation dropped,
 * because a path at the end of a sentence arrives as `/tasks?task=x.` and the full
 * stop is the writer's, not part of the id.
 */
export function recordPathInToken(token: string): string | null {
  const trimmed = token.replace(/[.,;:!?)\]]+$/, '')
  return isRecordLink(trimmed) ? trimmed : null
}

/** The record path an absolute URL points at, when it is one of our own links. */
function recordPathInUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return isRecordLink(`${parsed.pathname}${parsed.search}`)
      ? `${parsed.pathname}${parsed.search}`
      : null
  } catch {
    return null
  }
}

/**
 * A message body, split into text, URLs, mentions and record links.
 *
 * Record links are recognised twice on purpose, and both cases end as the same
 * part. A *relative* path is what the app hands out in-app (a notification, Mica's
 * reply) and is what the URL pass cannot see. An *absolute* URL on our own origin is
 * what an email's button points at, and it is turned into the relative path rather
 * than left as an external URL: opening `https://our-host/tasks?task=x` in a new tab
 * would reload the whole app instead of opening the record in the one already
 * running.
 */
export function renderMessageText(text: string): MessagePart[] {
  const markers: { index: number; end: number; type: MessagePart['type']; value: string }[] = []

  const urlRe = new RegExp(URL_REGEX.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    const raw = m[0]
    const record = recordPathInUrl(raw)
    markers.push({
      index: m.index,
      end: m.index + raw.length,
      type: record ? 'record' : 'url',
      // For a record URL the anchor carries the in-app path, so the same text can
      // never be both a link to open in a tab and a link to open in the app.
      value: record ?? raw,
    })
  }

  const recordRe = new RegExp(RECORD_PATH_REGEX.source, 'g')
  while ((m = recordRe.exec(text)) !== null) {
    const prefix = m[1]
    const record = recordPathInToken(m[2])
    if (!record) continue
    const start = m.index + prefix.length
    markers.push({ index: start, end: start + record.length, type: 'record', value: record })
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
  '😭','😱','😖','😣','😞','😓','😩','😫','😤','😡','😠','🤬','✋','👌','🤌',
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

/* Chat's colour names, resolved through the shared tokens rather than retyping
   the ramp — the chat surface and the marketing pages must not drift apart. */
export const NAVY = P.primary
export const NAVY_DEEP = P.primaryDeep
export const EMERALD = P.green
export const EMERALD_DEEP = NOTICE_COLORS.success.fg
export const INK = P.navy
export const MIST = P.slate
export const BONE = P.warm
export const HAIRLINE = P.hairline
export const WHITE = P.card
export const OUTLINE = '#D6E2EE'
export const WINDOW_BORDER = '#D6E2EE'
export const DANGER = '#EF4444'
