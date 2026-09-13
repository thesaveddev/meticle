import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Stack, Paper, Badge, Button
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
  body: string
  read: boolean
  created_at: string
  url?: string
}

const TYPE_COLORS: Record<string, string> = {
  missed_call: '#DC2626',
  call_assigned: '#3B82F6',
  disruption_reported: '#F59E0B',
  swap_request: '#8B5CF6',
  swap_response: '#10B981',
  compliance_expiry: '#EF4444',
  shift_start: '#14B8A6',
}

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
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [_loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications/')
      setNotifications(res.data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  const unread = notifications.filter(n => !n.read)

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={700}>Notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
          </Typography>
        </Box>
        {unread.length > 0 && (
          <Button startIcon={<MarkAllIcon />} onClick={markAllRead} size="small">
            Mark all read
          </Button>
        )}
      </Box>

      {notifications.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            You'll see alerts for missed calls, assigned visits, and disruptions here.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={0.5}>
          {notifications.map(n => {
            const color = TYPE_COLORS[n.type] || '#6B7280'
            return (
              <Paper
                key={n.id}
                variant="outlined"
                sx={{
                  p: 2, display: 'flex', alignItems: 'flex-start', gap: 2, cursor: 'pointer',
                  bgcolor: n.read ? 'transparent' : 'action.hover',
                  borderLeft: `3px solid ${color}`,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => { if (!n.read) markRead(n.id); if (n.url) window.open(n.url, '_blank') }}
              >
                <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <NotificationsIcon sx={{ fontSize: 18, color }} />
                </Box>
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={n.read ? 400 : 700}>{n.title}</Typography>
                    {!n.read && <Badge variant="dot" color="primary" />}
                  </Box>
                  <Typography variant="caption" color="text.secondary">{n.body}</Typography>
                  <Typography variant="caption" display="block" color="text.disabled" mt={0.5}>{timeAgo(n.created_at)}</Typography>
                </Box>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}
