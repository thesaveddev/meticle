import { useEffect, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Container, Grid, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  Phone as CallIcon,
  CheckCircle as CompletedIcon,
  DirectionsCar as RouteIcon,
  Group as CarerIcon,
  Warning as MissedIcon,
  Schedule as PendingIcon,
  AccessTime as TimeIcon,
  ArrowForward as ArrowIcon,
  TrendingUp as CoverageIcon,
} from '@mui/icons-material'
import api from '../../services/api'

interface DomiciliaryData {
  calls_today: number
  calls_completed: number
  calls_in_progress: number
  calls_scheduled: number
  calls_missed: number
  calls_cancelled: number
  calls_unassigned: number
  coverage_percent: number
  carers_working_today: number
  carers_with_calls: number
  next_call: { label: string; person_name: string; scheduled_start: string; carer_name: string | null } | null
  call_timeline: { id: string; label: string; person_name: string; scheduled_start: string; scheduled_end: string; status: string; carer_name: string | null }[]
  carer_breakdown: { carer_name: string; calls_assigned: number; calls_completed: number; calls_remaining: number }[]
  exceptions: { id: string; label: string; person_name: string; scheduled_start: string; status: string; carer_name: string | null; exception_type: string | null }[]
}

function time(value: string) { return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Done', color: '#047857', bg: '#E9F7F0' },
  checked_in: { label: 'At client', color: '#0F4C81', bg: '#E0F2FE' },
  en_route: { label: 'En route', color: '#7C3AED', bg: '#EDE9FE' },
  scheduled: { label: 'Upcoming', color: '#6B7280', bg: '#F3F4F6' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FDECEC' },
  cancelled: { label: 'Cancelled', color: '#D97706', bg: '#FFF5D9' },
}

export default function DomiciliaryDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DomiciliaryData | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await api.get('/dashboard/domiciliary')
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>
  if (error) return <Container maxWidth="lg" sx={{ py: 4 }}><Typography color="error">{error}</Typography></Container>
  if (!data) return null

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RouteIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Today's Calls</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">{data.calls_today} calls scheduled across {data.carers_working_today} carers</Typography>
      </Box>

      {/* Coverage bar */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #E5E7EB', borderRadius: 2, borderLeft: '4px solid #10b981' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <CoverageIcon sx={{ color: '#10b981', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Call Coverage</Typography>
          </Stack>
          <Typography variant="h6" sx={{ fontWeight: 800, color: data.coverage_percent >= 90 ? '#047857' : data.coverage_percent >= 70 ? '#D97706' : '#DC2626' }}>
            {data.coverage_percent}%
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={data.coverage_percent}
          sx={{ height: 8, borderRadius: 4, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: data.coverage_percent >= 90 ? '#10b981' : data.coverage_percent >= 70 ? '#D97706' : '#DC2626', borderRadius: 4 } }} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {data.calls_today - data.calls_unassigned} of {data.calls_today} calls have a carer assigned{data.calls_unassigned > 0 ? ` (${data.calls_unassigned} unassigned)` : ''}
        </Typography>
      </Paper>

      {/* Call stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Completed', value: data.calls_completed, color: '#047857', bg: '#E9F7F0', icon: <CompletedIcon /> },
          { label: 'In progress', value: data.calls_in_progress, color: '#0F4C81', bg: '#E0F2FE', icon: <CallIcon /> },
          { label: 'Upcoming', value: data.calls_scheduled, color: '#6B7280', bg: '#F3F4F6', icon: <PendingIcon /> },
          { label: 'Missed', value: data.calls_missed, color: '#DC2626', bg: '#FDECEC', icon: <MissedIcon /> },
          { label: 'Unassigned', value: data.calls_unassigned, color: '#D97706', bg: '#FFF5D9', icon: <TimeIcon /> },
        ].map(card => (
          <Grid item xs={6} sm={4} md={2.4} key={card.label}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}>
                {card.icon}
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: card.color }}>{card.value}</Typography>
              <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Next call alert */}
      {data.next_call && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #E5E7EB', borderRadius: 2, bgcolor: '#F0F9FF', borderLeft: '4px solid #0F4C81' }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <TimeIcon sx={{ color: '#0F4C81' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Next call: {time(data.next_call.scheduled_start)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {data.next_call.label} - {data.next_call.person_name}{data.next_call.carer_name ? ` (Carer: ${data.next_call.carer_name})` : ' (No carer assigned)'}
              </Typography>
            </Box>
            <Button size="small" endIcon={<ArrowIcon />} onClick={() => navigate('/homecare')} sx={{ color: '#0F4C81', fontWeight: 700, textTransform: 'none' }}>
              View calls
            </Button>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Call timeline */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Call Schedule</Typography>
            {data.call_timeline.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No calls scheduled today</Typography>
            ) : (
              <Stack spacing={0}>
                {data.call_timeline.map((call, i) => {
                  const cfg = statusConfig[call.status] || statusConfig.scheduled
                  return (
                    <Box key={call.id} sx={{ display: 'flex', gap: 2, py: 1.5, borderBottom: i < data.call_timeline.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <Box sx={{ width: 56, flexShrink: 0, textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F4C81' }}>{time(call.scheduled_start)}</Typography>
                        <Typography variant="caption" color="text.secondary">{time(call.scheduled_end)}</Typography>
                      </Box>
                      <Box sx={{ width: 3, bgcolor: cfg.color, borderRadius: 2, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{call.label}</Typography>
                          <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600, height: 20, fontSize: '0.65rem' }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {call.person_name}{call.carer_name ? ` - ${call.carer_name}` : ' - No carer'}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Carer breakdown */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 2, mb: 3 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <CarerIcon sx={{ color: '#10b981', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Carer Coverage</Typography>
            </Stack>
            {data.carer_breakdown.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No carers assigned today</Typography>
            ) : (
              <Stack spacing={1.5}>
                {data.carer_breakdown.map(carer => {
                  const progress = carer.calls_assigned > 0 ? (carer.calls_completed / carer.calls_assigned) * 100 : 0
                  return (
                    <Box key={carer.carer_name}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{carer.carer_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{carer.calls_completed}/{carer.calls_assigned}</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={progress}
                        sx={{ height: 4, borderRadius: 2, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: progress === 100 ? '#10b981' : '#0F4C81', borderRadius: 2 } }} />
                    </Box>
                  )
                })}
              </Stack>
            )}
          </Paper>

          {/* Exceptions */}
          {data.exceptions.length > 0 && (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #FEE2E2', borderRadius: 2, bgcolor: '#FFFBFB' }}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <MissedIcon sx={{ color: '#DC2626', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#DC2626' }}>Exceptions</Typography>
              </Stack>
              <Stack spacing={1}>
                {data.exceptions.map(ex => (
                  <Box key={ex.id} sx={{ py: 1, borderBottom: '1px solid #FEE2E2' }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip label={ex.status} size="small" sx={{ bgcolor: statusConfig[ex.status]?.bg || '#F3F4F6', color: statusConfig[ex.status]?.color || '#6B7280', height: 18, fontSize: '0.6rem' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{time(ex.scheduled_start)} - {ex.person_name}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Quick actions */}
      <Paper elevation={0} sx={{ p: 3, mt: 3, border: '1px solid #E5E7EB', borderRadius: 2, bgcolor: '#F8FAFC' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Quick actions</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {[
            { label: 'View all calls', path: '/homecare', color: '#10b981' },
            { label: 'Call schedule', path: '/call-scheduling', color: '#0F4C81' },
            { label: 'Mileage & travel', path: '/mileage', color: '#7C3AED' },
            { label: 'Carer totals', path: '/carer-totals', color: '#D97706' },
            { label: 'Payroll export', path: '/payroll-export', color: '#047857' },
            { label: 'Client billing', path: '/client-billing', color: '#0F4C81' },
          ].map(action => (
            <Button key={action.path} variant="outlined" size="small" endIcon={<ArrowIcon />}
              onClick={() => navigate(action.path)}
              sx={{ borderColor: action.color, color: action.color, fontWeight: 600, textTransform: 'none', '&:hover': { borderColor: action.color, bgcolor: `${action.color}08` } }}>
              {action.label}
            </Button>
          ))}
        </Stack>
      </Paper>
    </Container>
  )
}
