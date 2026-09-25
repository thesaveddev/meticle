import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Chip, LinearProgress, Alert, CircularProgress, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
} from '@mui/material'
import {
  LocationOn as LocationIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Event as EventIcon,
} from '@mui/icons-material'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'
import AppButton from '../../components/design/AppButton'

function time(v: string) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function localDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
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
  const [error, setError] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [detail, setDetail] = useState<any | null>(null)

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7)
  const weekEnd = addDays(weekStart, 6)

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError('')
    const from = new Date(weekStart); from.setHours(0, 0, 0, 0)
    const to = new Date(weekEnd); to.setHours(23, 59, 59, 999)
    try {
      const response = await api.get('/homecare/week-visits', {
        params: { from: from.toISOString(), to: to.toISOString() },
        timeout: 20_000,
      })
      setVisits(Array.isArray(response.data) ? response.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your week. Please try again.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  useEffect(() => { loadWeek() }, [loadWeek])

  // Group calls by day
  const grouped: Record<string, any[]> = {}
  for (const v of visits) {
    const key = localDateKey(v.scheduled_start)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  }

  const today = localDateKey(new Date())
  const completed = visits.filter(v => v.status === 'completed').length

  // Monday → Sunday of the selected week, always all seven days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    const key = localDateKey(date)
    return {
      key,
      date,
      isToday: key === today,
      label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      dateLabel: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      visits: grouped[key] || [],
    }
  })

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <PageContainer>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={0.5}>My week</Typography>
          <Typography variant="body2" color="text.secondary">{visits.length} calls · {completed} completed</Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton aria-label="Previous week" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeftIcon /></IconButton>
          <Typography fontWeight={700} sx={{ minWidth: 170, textAlign: 'center' }}>{weekLabel}</Typography>
          <IconButton aria-label="Next week" onClick={() => setWeekOffset(o => o + 1)}><ChevronRightIcon /></IconButton>
          {weekOffset !== 0 && <AppButton variant="quiet" size="small" onClick={() => setWeekOffset(0)}>This week</AppButton>}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<AppButton variant="secondary" size="small" onClick={loadWeek}>Try again</AppButton>}>
          {error}
        </Alert>
      )}

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

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(7, 1fr)' } }}>
          {days.map((day) => (
            <Paper
              key={day.key}
              variant="outlined"
              sx={{
                p: 1.5, minHeight: 170, display: 'flex', flexDirection: 'column', gap: 1,
                borderColor: day.isToday ? 'primary.main' : 'divider',
                borderWidth: day.isToday ? 2 : 1,
              }}
            >
              <Box>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  {day.isToday && <Box sx={{ width: 8, height: 8, borderRadius: 4, bgcolor: 'primary.main' }} />}
                  <Typography fontWeight={700} color={day.isToday ? 'primary.main' : 'text.primary'}>{day.label}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">{day.dateLabel}</Typography>
              </Box>

              {day.visits.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>No calls</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {day.visits.map((v: any) => (
                    <Paper
                      key={v.id}
                      variant="outlined"
                      onClick={() => setDetail(v)}
                      sx={{
                        p: 1, cursor: 'pointer', transition: 'border-color 0.15s ease, background 0.15s ease',
                        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} color="primary.main" display="block">
                        {time(v.scheduled_start)}–{time(v.scheduled_end)}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>{v.label}</Typography>
                      {v.person_name && <Typography variant="caption" color="text.secondary" display="block" noWrap>{v.person_name}</Typography>}
                      <Chip label={v.status?.replace(/_/g, ' ')} color={statusColor(v.status) as any} size="small" sx={{ mt: 0.5, height: 18, fontSize: '0.6rem' }} />
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* Call detail dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="xs" fullWidth>
        {detail && (
          <>
            <DialogTitle>
              <Typography variant="subtitle1" fontWeight={700}>{detail.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(detail.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip label={detail.status?.replace(/_/g, ' ')} color={statusColor(detail.status) as any} size="small" />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{time(detail.scheduled_start)} – {time(detail.scheduled_end)}</Typography>
                </Stack>
                {detail.person_name && (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">{detail.person_name}</Typography>
                  </Stack>
                )}
                {detail.person_address && (
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <LocationIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25 }} />
                    <Typography variant="body2" color="text.secondary">{detail.person_address}</Typography>
                  </Stack>
                )}
                {!detail.person_name && !detail.person_address && (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">No client details recorded for this call.</Typography>
                  </Stack>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetail(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </PageContainer>
  )
}
