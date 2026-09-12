import { useMemo, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { Today as TodayIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

const timeLabel = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateLabel = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const statusColor = (s: string) => {
  if (s === 'completed') return { bg: '#E9F7F0', color: '#047857' }
  if (s === 'missed' || s === 'cancelled') return { bg: '#FDECEC', color: '#B42318' }
  if (s === 'in_progress') return { bg: '#FFF5D9', color: '#D97706' }
  return { bg: '#F3F4F6', color: '#6B7280' }
}

export default function CallSchedulingPage() {
  const [offset, setOffset] = useState(0)
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'

  const today = new Date()
  today.setDate(today.getDate() + offset)
  const dayStr = today.toISOString().slice(0, 10)
  const nextDayStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-schedule', dayStr, isManager],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', {
      params: { from: dayStr, to: nextDayStr }
    }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const sorted = [...visits].sort((a: any, b: any) => new Date(a.scheduled_start || a.visit_date).getTime() - new Date(b.scheduled_start || b.visit_date).getTime())

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Call Schedule</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>Today's visit schedule and call patterns</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
        <Button size="small" onClick={() => setOffset(o => o - 1)} sx={{ minWidth: 'auto' }}><ChevronLeftIcon /></Button>
        <Chip
          icon={<TodayIcon />}
          label={`${dateLabel(dayStr)} — ${visits.length} calls`}
          color={offset === 0 ? 'primary' : 'default'}
          onClick={() => setOffset(0)}
          sx={{ fontWeight: 700, bgcolor: offset === 0 ? '#0F4C81' : undefined, color: offset === 0 ? 'white' : undefined }}
        />
        <Button size="small" onClick={() => setOffset(o => o + 1)} sx={{ minWidth: 'auto' }}><ChevronRightIcon /></Button>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Carer</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Package</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: '#6B7280' }}>No calls scheduled for this day</TableCell></TableRow>
              ) : sorted.map((v: any) => {
                const start = v.scheduled_start || v.visit_date
                const end = v.scheduled_end
                const dur = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : null
                const cfg = statusColor(v.status || 'scheduled')
                return (
                  <TableRow key={v.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {timeLabel(start)}
                        {end && ` – ${timeLabel(end)}`}
                      </Typography>
                    </TableCell>
                    <TableCell>{v.person_name || '—'}</TableCell>
                    <TableCell>{v.carer_name || <Typography sx={{ color: '#D97706', fontWeight: 600 }}>Unassigned</Typography>}</TableCell>
                    <TableCell>{v.package_name || '—'}</TableCell>
                    <TableCell>{dur != null ? `${dur} min` : '—'}</TableCell>
                    <TableCell>
                      <Chip label={v.status?.replace(/_/g, ' ') || 'scheduled'} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
