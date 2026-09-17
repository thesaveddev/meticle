import { useEffect, useState, useCallback } from 'react'
import { Box, Button, CircularProgress, Container, Grid, IconButton, LinearProgress, Stack, Typography, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import {
  Phone as CallIcon,
  CheckCircle as CompletedIcon,
  Group as CarerIcon,
  Warning as MissedIcon,
  Schedule as PendingIcon,
  AccessTime as TimeIcon,
  ArrowForward as ArrowIcon,
  TrendingUp as CoverageIcon,
  Assignment as UnassignedIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { PremiumCard, StatCard, SectionHeader, StatusBadge } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'

interface DomiciliaryData {
  selected_date: string
  is_today: boolean
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
  call_timeline: { id: string; label: string; person_name: string; scheduled_start: string; scheduled_end: string; status: string; carer_name: string | null; tasks_total: number; tasks_completed: number }[]
  carer_breakdown: { carer_name: string; calls_assigned: number; calls_completed: number; calls_remaining: number }[]
  exceptions: { id: string; label: string; person_name: string; scheduled_start: string; status: string; carer_name: string | null; exception_type: string | null }[]
}

function time(value: string) { return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Done', color: '#047857', bg: '#E9F7F0' },
  checked_in: { label: 'At client', color: '#0F4C81', bg: '#E0F2FE' },
  en_route: { label: 'En route', color: '#7C3AED', bg: '#EDE9FE' },
  scheduled: { label: 'Upcoming', color: 'text.secondary', bg: '#F3F4F6' },
  missed: { label: 'Missed', color: '#DC2626', bg: '#FDECEC' },
  cancelled: { label: 'Cancelled', color: '#D97706', bg: '#FFF5D9' },
}

export default function DomiciliaryDashboard() {
  const navigate = useNavigate()
  const theme = useTheme()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DomiciliaryData | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await api.get('/dashboard/domiciliary', { params: { date } })
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(selectedDate) }, [selectedDate, load])
  const [showAllCalls, setShowAllCalls] = useState(false)
  const VISIBLE_CALLS = 8

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>
  if (error) return <Container maxWidth="lg" sx={{ py: 4 }}><Typography color="error">{error}</Typography></Container>
  if (!data) return null

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isToday = selectedDate === today
  const greeting = (() => {
    if (!isToday) return 'Dashboard'
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  })()

  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            {greeting}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton size="small" onClick={() => navigateDate(-1)} sx={{ color: theme.palette.text.secondary }}>
              <PrevIcon fontSize="small" />
            </IconButton>
            <Chip
              icon={<CalendarIcon sx={{ fontSize: 14 }} />}
              label={dateLabel}
              onClick={() => setSelectedDate(today)}
              variant={isToday ? 'filled' : 'outlined'}
              color={isToday ? 'primary' : 'default'}
              sx={{ fontWeight: 600, cursor: isToday ? 'default' : 'pointer' }}
            />
            <IconButton size="small" onClick={() => navigateDate(1)} disabled={isToday} sx={{ color: theme.palette.text.secondary }}>
              <NextIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          {data.calls_today} calls scheduled across {data.carers_working_today} carers{isToday ? ' today' : ` on ${dateLabel}`}
        </Typography>
      </Box>

      {/* Coverage Hero Card */}          <PremiumCard noBorder sx={{ p: 4, mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={4}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `5px solid ${data.coverage_percent >= 90 ? '#10B981' : data.coverage_percent >= 70 ? '#D97706' : '#DC2626'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, color: data.coverage_percent >= 90 ? '#10B981' : data.coverage_percent >= 70 ? '#D97706' : '#DC2626' }}>
              {data.coverage_percent}%
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Today's Coverage</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              {data.calls_today - data.calls_unassigned} of {data.calls_today} calls have a carer assigned
              {data.calls_unassigned > 0 && ` (${data.calls_unassigned} unassigned)`}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={data.coverage_percent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                '& .MuiLinearProgress-bar': {
                  bgcolor: data.coverage_percent >= 90 ? '#10B981' : data.coverage_percent >= 70 ? '#D97706' : '#DC2626',
                  borderRadius: 4,
                },
              }}
            />
          </Box>
          {data.coverage_percent >= 90 ? (
            <Chip
              icon={<CompletedIcon sx={{ fontSize: 16, color: '#fff' }} />}
              label="All covered!"
              sx={{ bgcolor: '#047857', color: '#fff', fontWeight: 700, borderRadius: '12px', px: 1 }}
            />
          ) : (
            <Chip
              icon={<CoverageIcon sx={{ fontSize: 16 }} />}
              label={`${data.coverage_percent}% covered`}
              sx={{
                bgcolor: data.coverage_percent >= 70 ? '#FFF5D9' : '#FDECEC',
                color: data.coverage_percent >= 70 ? '#92400E' : '#DC2626',
                fontWeight: 700,
                borderRadius: '12px',
                px: 1,
              }}
            />
          )}
        </Stack>
      </PremiumCard>

      {/* Call Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          { label: 'Completed', value: data.calls_completed, color: '#10B981', icon: <CompletedIcon />, filter: 'completed' },
          { label: 'In Progress', value: data.calls_in_progress, color: '#0F4C81', icon: <CallIcon />, filter: 'checked_in' },
          { label: 'Upcoming', value: data.calls_scheduled, color: 'text.secondary', icon: <PendingIcon />, filter: 'scheduled' },
          { label: 'Missed', value: data.calls_missed, color: '#DC2626', icon: <MissedIcon />, filter: 'missed' },
          { label: 'Unassigned', value: data.calls_unassigned, color: '#D97706', icon: <UnassignedIcon />, filter: '' },
        ].map(card => (
          <Grid item xs={6} sm={4} md={2.4} key={card.label}>
            <StatCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              color={card.color}
              onClick={() => navigate(card.filter ? `/homecare?status=${card.filter}` : '/homecare')}
            />
          </Grid>
        ))}
      </Grid>

      {/* Next Call Alert */}
      {data.next_call && (
        <PremiumCard
          noBorder
          sx={{ p: 3, mb: 4, bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F0F9FF' }}
        >
          <Stack direction="row" alignItems="center" gap={2}>
            <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: theme.palette.mode === 'dark' ? '#1E3A5F' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TimeIcon sx={{ color: theme.palette.mode === 'dark' ? '#60A5FA' : '#0F4C81' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Next call: {time(data.next_call.scheduled_start)}</Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {data.next_call.label} — {data.next_call.person_name}
                {data.next_call.carer_name ? ` (Carer: ${data.next_call.carer_name})` : ' (No carer assigned)'}
              </Typography>
            </Box>
            <Button
              size="small"
              endIcon={<ArrowIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/homecare')}
              sx={{ color: theme.palette.mode === 'dark' ? '#60A5FA' : '#0F4C81', fontWeight: 700, textTransform: 'none', fontSize: '0.8rem' }}
            >
              View calls
            </Button>
          </Stack>
        </PremiumCard>
      )}

      <Grid container spacing={3}>
        {/* Call Timeline */}
        <Grid item xs={12} md={8}>
          <PremiumCard noBorder sx={{ p: 4 }}>
            <SectionHeader title="Call Schedule" subtitle={`${data.call_timeline.length} calls${isToday ? ' today' : ''}`} />
            {data.call_timeline.length === 0 ? (
              <EmptyState
                icon={<CallIcon />}
                title={isToday ? 'No calls today' : `No calls on ${dateLabel}`}
                description={isToday ? 'No calls scheduled today.' : 'No calls scheduled for this date.'}
              />
            ) : (
              <>
              <Stack spacing={0}>
                {(showAllCalls ? data.call_timeline : data.call_timeline.slice(0, VISIBLE_CALLS)).map((call, i) => {
                  const cfg = statusConfig[call.status] || statusConfig.scheduled
                  return (
                    <Box
                      key={call.id}
                      onClick={() => navigate(`/homecare?status=${call.status}`)}
                      sx={{
                        display: 'flex',
                        gap: 'var(--card-gap)',
                        py: 2,
                        borderBottom: i < (showAllCalls ? data.call_timeline.length : Math.min(VISIBLE_CALLS, data.call_timeline.length)) - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        mx: -1,
                        px: 1,
                        transition: 'background-color 0.15s',
                        '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                      }}
                    >
                      <Box sx={{ width: 64, flexShrink: 0, textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F4C81' }}>
                          {time(call.scheduled_start)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                          {time(call.scheduled_end)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 3,
                          bgcolor: cfg.color,
                          borderRadius: 2,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{call.label}</Typography>
                          <StatusBadge variant={call.status as any} label={cfg.label} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                          {call.person_name}{call.carer_name ? ` — ${call.carer_name}` : ' — No carer'}
                        </Typography>
                        {call.tasks_total > 0 && (
                          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: call.tasks_completed === call.tasks_total ? '#E9F7F0' : '#FFF5D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {call.tasks_completed === call.tasks_total ? (
                                <CompletedIcon sx={{ fontSize: 10, color: '#10B981' }} />
                              ) : (
                                <PendingIcon sx={{ fontSize: 10, color: '#D97706' }} />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: call.tasks_completed === call.tasks_total ? '#047857' : '#92400E', fontSize: '0.7rem' }}>
                              {call.tasks_completed}/{call.tasks_total} tasks
                            </Typography>
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
              {data.call_timeline.length > VISIBLE_CALLS && (
                <Button
                  size="small"
                  endIcon={<ArrowIcon sx={{ fontSize: 16, transform: showAllCalls ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />}
                  onClick={() => setShowAllCalls(!showAllCalls)}
                  sx={{ mt: 2, color: '#0F4C81', fontWeight: 700, textTransform: 'none', fontSize: '0.85rem', justifyContent: 'flex-start' }}
                >
                  {showAllCalls ? 'Show less' : `View all ${data.call_timeline.length} calls`}
                </Button>
              )}
              </>
            )}
          </PremiumCard>
        </Grid>

        {/* Carer Breakdown + Exceptions */}
        <Grid item xs={12} md={4}>
          <PremiumCard noBorder sx={{ p: 4, mb: 3 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CarerIcon sx={{ color: '#047857', fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Carer Coverage</Typography>
            </Stack>
            {data.carer_breakdown.length === 0 ? (
              <EmptyState
                icon={<CarerIcon />}
                title="No carers assigned"
                description={isToday ? 'No carers assigned to calls today.' : 'No carers assigned to calls for this date.'}
              />
            ) : (
              <Stack spacing={2}>
                {data.carer_breakdown.map(carer => {
                  const progress = carer.calls_assigned > 0 ? (carer.calls_completed / carer.calls_assigned) * 100 : 0
                  return (
                    <Box key={carer.carer_name}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{carer.carer_name}</Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                          {carer.calls_completed}/{carer.calls_assigned}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: progress === 100 ? '#10B981' : '#0F4C81',
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>
                  )
                })}
              </Stack>
            )}
          </PremiumCard>

          {/* Exceptions */}
          {data.exceptions.length > 0 && (
            <PremiumCard noBorder sx={{ p: 4, bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#FFFBFB', cursor: 'pointer', '&:hover': { boxShadow: 2 }, transition: 'box-shadow 0.15s' }} onClick={() => navigate('/homecare?status=missed')}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: 'error.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MissedIcon sx={{ color: '#DC2626', fontSize: 18 }} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#DC2626' }}>Exceptions</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {data.exceptions.map(ex => (
                  <Box key={ex.id} sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <StatusBadge variant={ex.status as any} label={ex.status} sx={{ height: 18, fontSize: '0.6rem' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {time(ex.scheduled_start)} — {ex.person_name}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </PremiumCard>
          )}
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <PremiumCard noBorder sx={{ p: 4, mt: 3, bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC' }}>
        <SectionHeader title="Quick actions" />
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {[
            { label: 'All calls', path: '/homecare', color: '#10B981' },
            { label: 'Schedule', path: '/call-scheduling', color: '#0F4C81' },
            { label: 'Mileage', path: '/mileage', color: '#7C3AED' },
            { label: 'Carer totals', path: '/carer-totals', color: '#D97706' },
            { label: 'Payroll', path: '/payroll-export', color: '#047857' },
            { label: 'Billing', path: '/client-billing', color: '#0F4C81' },
          ].map(action => (
            <Button
              key={action.path}
              variant="outlined"
              size="small"
              endIcon={<ArrowIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate(action.path)}
              sx={{
                borderColor: `${action.color}30`,
                color: action.color,
                fontWeight: 600,
                fontSize: '0.8rem',
                textTransform: 'none',
                borderRadius: '10px',
                px: 2,
                py: 0.75,
                '&:hover': { borderColor: action.color, bgcolor: `${action.color}08` },
              }}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </PremiumCard>
    </Box>
  )
}
