import { useEffect, useState, useCallback } from 'react'
import { Box, Button, CircularProgress, Container, Divider, Grid, IconButton, LinearProgress, Stack, Typography, Chip } from '@mui/material'
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
  completed: { label: 'Done', color: '#087A55', bg: '#EAFBF5' },
  checked_in: { label: 'At client', color: '#2F80ED', bg: '#EAF3FF' },
  en_route: { label: 'En route', color: '#8B7CF6', bg: '#F4F8FF' },
  scheduled: { label: 'Upcoming', color: 'text.secondary', bg: '#F7F9FC' },
  missed: { label: 'Missed', color: '#EF4444', bg: '#FEF0F0' },
  cancelled: { label: 'Cancelled', color: '#F59E0B', bg: '#FFF7E6' },
}

export default function DomiciliaryDashboard() {
  const navigate = useNavigate()
  const theme = useTheme()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DomiciliaryData | null>(null)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<{ cards: { label: string; value: string | number; subtitle: string; color: string }[]; attention: { label: string; value: number; action: string; target: string }[]; generatedAt: string } | null>(null)

  const load = useCallback(async (date: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/dashboard/domiciliary', { params: { date }, timeout: 15000 })
      setData(res.data)
      api.get('/reporting/overview', { timeout: 15000 }).then(r => setOverview(r.data)).catch(() => {})
    } catch (err: any) {
      setError(err.code === 'ECONNABORTED'
        ? 'Dashboard data is taking too long to respond. Please try again.'
        : err.response?.data?.message || 'Failed to load dashboard')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(selectedDate) }, [selectedDate, load])
  const [showAllCalls, setShowAllCalls] = useState(false)
  const VISIBLE_CALLS = 8

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>
  if (error) return <Container maxWidth="lg" sx={{ py: 4 }}><Stack spacing={2} alignItems="flex-start"><Typography color="error">{error}</Typography><Button variant="outlined" onClick={() => load(selectedDate)}>Retry</Button></Stack></Container>
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
              border: `5px solid ${data.coverage_percent >= 90 ? '#10B981' : data.coverage_percent >= 70 ? '#F59E0B' : '#EF4444'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, color: data.coverage_percent >= 90 ? '#10B981' : data.coverage_percent >= 70 ? '#F59E0B' : '#EF4444' }}>
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
                bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F5F7FA',
                '& .MuiLinearProgress-bar': {
                  bgcolor: data.coverage_percent >= 90 ? '#10B981' : data.coverage_percent >= 70 ? '#F59E0B' : '#EF4444',
                  borderRadius: 4,
                },
              }}
            />
          </Box>
          {data.coverage_percent >= 90 ? (
            <Chip
              icon={<CompletedIcon sx={{ fontSize: 16, color: '#FFFFFF' }} />}
              label="All covered!"
              sx={{ bgcolor: '#087A55', color: '#FFFFFF', fontWeight: 700, borderRadius: '12px', px: 1 }}
            />
          ) : (
            <Chip
              icon={<CoverageIcon sx={{ fontSize: 16 }} />}
              label={`${data.coverage_percent}% covered`}
              sx={{
                bgcolor: data.coverage_percent >= 70 ? '#FFF7E6' : '#FEF0F0',
                color: data.coverage_percent >= 70 ? '#9A6700' : '#EF4444',
                fontWeight: 700,
                borderRadius: '12px',
                px: 1,
              }}
            />
          )}
        </Stack>
      </PremiumCard>

      {/* Operational Pulse */}
      {overview && overview.cards.length > 0 && (
        <PremiumCard noBorder sx={{ p: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: '#2F80ED', fontWeight: 800, letterSpacing: '0.12em', fontSize: '0.65rem' }}>Operational pulse</Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                {overview.cards.map(card => (
                  <Grid item xs={6} sm={4} key={card.label}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: card.color }}>{card.value}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{card.label}</Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem' }}>{card.subtitle}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
            {overview.attention.length > 0 && (
              <>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' } }} />
                <Box sx={{ width: { xs: '100%', lg: 260 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, fontSize: '0.85rem' }}>Quick actions</Typography>
                  <Stack spacing={0.5}>
                    {overview.attention.map(item => (
                      <Button key={item.label} size="small" endIcon={<ArrowIcon />} onClick={() => navigate(item.target === 'locations' ? '/care-areas' : `/homecare`)} sx={{ justifyContent: 'space-between', textTransform: 'none', color: item.value > 0 ? '#EF4444' : 'text.primary', fontSize: '0.8rem' }}>
                        <span>{item.label}: <strong>{item.value}</strong></span>
                      </Button>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </PremiumCard>
      )}

      {/* Call Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          { label: 'Completed', value: data.calls_completed, color: '#10B981', icon: <CompletedIcon />, filter: 'completed' },
          { label: 'In Progress', value: data.calls_in_progress, color: '#2F80ED', icon: <CallIcon />, filter: 'checked_in' },
          { label: 'Upcoming', value: data.calls_scheduled, color: 'text.secondary', icon: <PendingIcon />, filter: 'scheduled' },
          { label: 'Missed', value: data.calls_missed, color: '#EF4444', icon: <MissedIcon />, filter: 'missed' },
          { label: 'Unassigned', value: data.calls_unassigned, color: '#F59E0B', icon: <UnassignedIcon />, filter: '' },
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
          sx={{ p: 3, mb: 4, bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F4F8FF' }}
        >
          <Stack direction="row" alignItems="center" gap={2}>
            <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: theme.palette.mode === 'dark' ? '#243B5A' : '#EAF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TimeIcon sx={{ color: theme.palette.mode === 'dark' ? '#6B8AFD' : '#2F80ED' }} />
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
              sx={{ color: theme.palette.mode === 'dark' ? '#6B8AFD' : '#2F80ED', fontWeight: 700, textTransform: 'none', fontSize: '0.8rem' }}
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
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2F80ED' }}>
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
                            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: call.tasks_completed === call.tasks_total ? '#EAFBF5' : '#FFF7E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {call.tasks_completed === call.tasks_total ? (
                                <CompletedIcon sx={{ fontSize: 10, color: '#10B981' }} />
                              ) : (
                                <PendingIcon sx={{ fontSize: 10, color: '#F59E0B' }} />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: call.tasks_completed === call.tasks_total ? '#087A55' : '#9A6700', fontSize: '0.7rem' }}>
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
                  sx={{ mt: 2, color: '#2F80ED', fontWeight: 700, textTransform: 'none', fontSize: '0.85rem', justifyContent: 'flex-start' }}
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
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: '#EAFBF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CarerIcon sx={{ color: '#087A55', fontSize: 18 }} />
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
                          bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F5F7FA',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: progress === 100 ? '#10B981' : '#2F80ED',
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
                <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: 'notice.error.bg', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MissedIcon sx={{ color: 'notice.error.fg', fontSize: 18 }} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#EF4444' }}>Exceptions</Typography>
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
            { label: 'Schedule', path: '/call-scheduling', color: '#2F80ED' },
            { label: 'Mileage', path: '/mileage', color: '#8B7CF6' },
            { label: 'Carer totals', path: '/payroll-timesheets?view=carer-totals', color: '#F59E0B' },
            { label: 'Payroll', path: '/payroll-export', color: '#087A55' },
            { label: 'Billing', path: '/client-billing', color: '#2F80ED' },
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
