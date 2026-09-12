import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Chip, LinearProgress, Alert, CircularProgress, Stack,
} from '@mui/material'
import api from '../../services/api'

function time(v: string) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusColor(s: string) {
  switch (s) {
    case 'completed': return 'success'
    case 'checked_in': return 'primary'
    case 'en_route': return 'info'
    case 'missed': return 'error'
    default: return 'default'
  }
}

export default function MyWeekPage() {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error] = useState('')

  useEffect(() => {
    const now = new Date()
    const from = new Date(now); from.setHours(0, 0, 0, 0)
    const to = new Date(now); to.setDate(to.getDate() + 7); to.setHours(23, 59, 59)
    api.get('/homecare/week-visits', { params: { from: from.toISOString(), to: to.toISOString() } })
      .then(res => setVisits(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Group by day
  const grouped: Record<string, any[]> = {}
  for (const v of visits) {
    const key = new Date(v.scheduled_start).toISOString().split('T')[0]
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  }
  const days = Object.keys(grouped).sort()
  const today = new Date().toISOString().split('T')[0]
  const completed = visits.filter(v => v.status === 'completed').length

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>

  return (
    <Box maxWidth={900} mx="auto" py={4} px={2}>
      <Typography variant="h4" fontWeight={700} mb={1}>My week</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>{visits.length} calls · {completed} completed</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Progress */}
      {visits.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" fontWeight={600}>{completed} of {visits.length} calls completed</Typography>
            <Typography variant="body2" color="text.secondary">{Math.round((completed / visits.length) * 100)}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={(completed / visits.length) * 100} color="success" sx={{ height: 8, borderRadius: 4 }} />
        </Paper>
      )}

      {days.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" mb={1}>No calls this week</Typography>
          <Typography color="text.secondary">Your coordinator will add calls when your route is ready.</Typography>
        </Paper>
      ) : (
        days.map(dayKey => {
          const dayVisits = grouped[dayKey]
          const isToday = dayKey === today
          const dayLabel = new Date(dayKey + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
          const dayCompleted = dayVisits.filter((v: any) => v.status === 'completed').length

          return (
            <Box key={dayKey} mb={3}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                {isToday && <Box sx={{ width: 8, height: 8, borderRadius: 4, bgcolor: 'primary.main' }} />}
                <Typography fontWeight={700} color={isToday ? 'primary.main' : 'text.primary'}>{dayLabel}</Typography>
                <Typography variant="body2" color="text.secondary">{dayVisits.length} calls</Typography>
                <Typography variant="body2" color="success.main" fontWeight={600}>{dayCompleted}/{dayVisits.length}</Typography>
              </Box>

              <Stack spacing={1}>
                {dayVisits.map((v: any) => (
                  <Paper key={v.id} variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start', '&:hover': { bgcolor: 'action.hover' } }}>
                    <Box sx={{ minWidth: 60 }}>
                      <Typography fontWeight={700} color="primary.main" fontSize={14}>{time(v.scheduled_start)}</Typography>
                      <Typography variant="caption" color="text.secondary">{time(v.scheduled_end)}</Typography>
                    </Box>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography fontWeight={600}>{v.label}</Typography>
                        <Chip label={v.status?.replace(/_/g, ' ')} color={statusColor(v.status) as any} size="small" />
                      </Box>
                      {v.person_name && <Typography variant="body2" color="text.secondary">{v.person_name}</Typography>}
                      {v.person_address && <Typography variant="caption" color="text.secondary">📍 {v.person_address}</Typography>}
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )
        })
      )}
    </Box>
  )
}
