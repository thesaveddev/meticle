import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Typography, Stack, Paper, Badge, Button, CircularProgress
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  MarkEmailRead as MarkAllIcon,
} from '@mui/icons-material'
import api from '../../services/api'

interface Notification {
  id: string
  type: string
  title: string
  /** The row's own copy — `message` on the API, not `body`. */
  message: string
  read: boolean
  created_at: string
  /**
   * The record this notification is about, where it is about one: a relative record
   * path (`micaRecordPath` in `@meticle-shared`). Pushed through the router rather
   * than opened as a URL, so the reader stays in the app they are signed into.
   */
  link?: string | null
}

const TYPE_COLORS: Record<string, string> = {
  missed_call: '#EF4444',
  call_assigned: '#0164C8',
  disruption_reported: '#F59E0B',
  swap_request: '#8B7CF6',
  swap_response: '#10B981',
  compliance_expiry: '#EF4444',
  shift_start: '#03C6B1',
}

/** How many rows one page asks for. The API caps it at 100. */
const PAGE_SIZE = 30

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  // The server's own unread total. Counting the loaded rows instead would report
  // zero to someone whose unread notifications are all older than page one.
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnread = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count', { silentError: true })
      setUnreadCount(Number(res.data?.count || 0))
    } catch { /* the header count is not worth an error banner */ }
  }, [])

  /**
   * One page of the inbox, newest first.
   *
   * The cursor is the last row already on screen — its `created_at` and `id` — so
   * the next page continues from that row even though notifications are being
   * written while the list is read. An offset would skip one row per arrival, and
   * the row it skipped would be the one that had just crossed the boundary: the
   * handover nudge or missed round that mattered.
   */
  const loadPage = useCallback(async (cursor: { before: string; beforeId: string } | null) => {
    setError('')
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (cursor) {
        params.set('before', cursor.before)
        params.set('beforeId', cursor.beforeId)
      }
      const res = await api.get(`/notifications?${params.toString()}`, { silentError: true })
      const rows: Notification[] = Array.isArray(res.data) ? res.data : []
      setNotifications(prev => {
        if (!cursor) return rows
        // A row can be written between pages; it appears at the top of the next
        // read only if somebody else's page shifted. De-duplicating by id keeps a
        // React key stable and the list honest.
        const seen = new Set(prev.map(item => item.id))
        return [...prev, ...rows.filter(item => !seen.has(item.id))]
      })
      setHasMore(rows.length === PAGE_SIZE)
      return rows
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your notifications.')
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadPage(null)
      if (!cancelled) { setLoading(false) }
      await refreshUnread()
    })()
    return () => { cancelled = true }
  }, [loadPage, refreshUnread])

  const loadOlder = async () => {
    const last = notifications[notifications.length - 1]
    if (!last || loadingMore) return
    setLoadingMore(true)
    await loadPage({ before: last.created_at, beforeId: last.id })
    setLoadingMore(false)
  }

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {}, { silentError: true })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(count => Math.max(0, count - 1))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all', {}, { silentError: true })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={600}>Notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Typography>
        </Box>
        {unreadCount > 0 && (
          <Button startIcon={<MarkAllIcon />} onClick={markAllRead} size="small">
            Mark all read
          </Button>
        )}
      </Box>

      {error && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => { setLoading(true); loadPage(null).finally(() => setLoading(false)) }}>Retry</Button>}
        >
          {error}
        </Alert>
      )}

      {/* An inbox that could not be read is not an empty inbox. Saying both at
          once reads as "nothing has happened", which is the one thing the error
          is trying to deny. */}
      {notifications.length === 0 && !error ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            You'll see alerts for missed calls, assigned visits, and disruptions here.
          </Typography>
        </Paper>
      ) : (
        <>
          <Stack spacing={0.5}>
            {notifications.map(n => {
              const color = TYPE_COLORS[n.type] || '#51637A'
              return (
                <Paper
                  key={n.id}
                  variant="outlined"
                  sx={{
                    p: 2, display: 'flex', alignItems: 'flex-start', gap: 'var(--card-gap)', cursor: 'pointer',
                    bgcolor: n.read ? 'transparent' : 'action.hover',
                    borderLeft: `3px solid ${color}`,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => { if (!n.read) markRead(n.id); if (n.link) navigate(n.link) }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <NotificationsIcon sx={{ fontSize: 18, color }} />
                  </Box>
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={n.read ? 400 : 700}>{n.title}</Typography>
                      {!n.read && <Badge variant="dot" color="primary" />}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{n.message}</Typography>
                    <Typography variant="caption" display="block" color="text.disabled" mt={0.5}>{timeAgo(n.created_at)}</Typography>
                  </Box>
                </Paper>
              )
            })}
          </Stack>

          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Button onClick={loadOlder} disabled={loadingMore} size="small">
                {loadingMore ? <CircularProgress size={16} /> : 'Load older notifications'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Stack>
  )
}
