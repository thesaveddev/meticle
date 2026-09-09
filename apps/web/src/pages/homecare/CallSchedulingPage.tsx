import { useMemo, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Container, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { Today as TodayIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

const timeLabel = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateLabel = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const statusColor = (s: string) => {
  if (s === 'completed') return 'success'
  if (s === 'missed' || s === 'cancelled') return 'error'
  if (s === 'in_progress') return 'warning'
  return 'default'
}

export default function CallSchedulingPage() {
  const [offset, setOffset] = useState(0)
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'

  const today = new Date()
  today.setDate(today.getDate() + offset)
  const dayStr = today.toISOString().slice(0, 10)

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['homecare-visits-schedule', dayStr, isManager],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', {
      params: { from: dayStr, to: dayStr }
    }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const sorted = [...visits].sort((a: any, b: any) => new Date(a.scheduled_start || a.visit_date).getTime() - new Date(b.scheduled_start || b.visit_date).getTime())

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Call Schedule</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Today's visit schedule and call patterns</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
        <Button size="small" onClick={() => setOffset(o => o - 1)}><ChevronLeftIcon /></Button>
        <Chip
          icon={<TodayIcon />}
          label={`${dateLabel(dayStr)} — ${visits.length} visits`}
          color={offset === 0 ? 'primary' : 'default'}
          onClick={() => setOffset(0)}
          sx={{ fontWeight: 700 }}
        />
        <Button size="small" onClick={() => setOffset(o => o + 1)}><ChevronRightIcon /></Button>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Carer</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No visits scheduled for this day</TableCell></TableRow>
              ) : sorted.map((v: any) => {
                const start = v.scheduled_start || v.visit_date
                const end = v.scheduled_end
                const dur = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : null
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {timeLabel(start)}
                        {end && ` – ${timeLabel(end)}`}
                      </Typography>
                    </TableCell>
                    <TableCell>{v.person_name || '—'}</TableCell>
                    <TableCell>{v.carer_name || 'Unassigned'}</TableCell>
                    <TableCell>{v.package_name || '—'}</TableCell>
                    <TableCell>{dur != null ? `${dur} min` : '—'}</TableCell>
                    <TableCell>
                      <Chip label={v.status?.replace(/_/g, ' ') || 'scheduled'} size="small" color={statusColor(v.status) as any} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
