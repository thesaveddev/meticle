import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Grid, Stack, Chip, IconButton, Skeleton,
  Tooltip, Button, LinearProgress, Collapse,
} from '@mui/material'
import {
  Warning as MissedIcon, PersonOff as UnassignedIcon, Schedule as OverdueIcon,
  CheckCircle as CompletedIcon, Refresh as RefreshIcon, OpenInNew as GotoIcon,
  Shield as ComplianceIcon, Assignment as IncidentIcon, Policy as CarePlanIcon,
  ExpandMore, ExpandLess, AccessTime, Person,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import PageMeta from '../../components/PageMeta'
import PageContainer from '../../components/design/PageContainer'

interface HomecareSummary {
  missed_today: number
  unassigned_today: number
  unassigned_upcoming: number
  overdue_calls: number
  completed_today: number
  total_today: number
  training_expiring: number
  docs_expiring: number
  open_incidents: number
  overdue_incident_actions: number
  overdue_care_plans: number
  carers_working_today: number
  calls_by_status: { status: string; count: number }[]
  missed_trend: { day: string; count: number }[]
  missed_by_carer: { carer_name: string; count: number }[]
}

/* ── Alert Card ── */
function AlertCard({ icon, label, value, color, bg, onClick, subtitle }: {
  icon: React.ReactNode; label: string; value: number; color: string; bg: string
  onClick?: () => void; subtitle?: string
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5, border: value > 0 ? `2px solid ${color}` : '1px solid', borderColor: 'divider',
        borderRadius: 2.5, cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', height: '100%',
        '&:hover': onClick ? { boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transform: 'translateY(-1px)' } : {},
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: bg, display: 'grid', placeItems: 'center' }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</Typography>
        </Box>
      </Stack>
      {subtitle && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{subtitle}</Typography>}
    </Paper>
  )
}

/* ── Main Page ── */
export default function HomecareMissionControl() {
  const nav = useNavigate()
  const [data, setData] = useState<HomecareSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedCarer, setExpandedCarer] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/mission-control/homecare-summary')
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load mission control data')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const completionRate = data && data.total_today > 0
    ? Math.round((data.completed_today / data.total_today) * 100)
    : 0

  const totalOpenIssues = data
    ? data.missed_today + data.unassigned_today + data.overdue_calls +
      data.training_expiring + data.docs_expiring + data.open_incidents +
      data.overdue_incident_actions + data.overdue_care_plans
    : 0

  return (
    <PageContainer>
      <PageMeta title="Mission Control" description="Domiciliary care operational overview" />

      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: totalOpenIssues > 0 ? '#FEF2F2' : '#F0FDF4', display: 'grid', placeItems: 'center' }}>
            <MissedIcon sx={{ color: totalOpenIssues > 0 ? '#DC2626' : '#22C55E', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Mission Control</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {totalOpenIssues > 0 ? `${totalOpenIssues} issue${totalOpenIssues !== 1 ? 's' : ''} need attention` : 'All clear — no open issues'}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={load} disabled={loading} sx={{ color: 'text.secondary' }}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error && <Typography color="error" mb={2} sx={{ fontSize: '0.85rem' }}>{error}</Typography>}

      {loading && !data ? (
        <Stack spacing={2}>
          {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 2.5 }} />)}
        </Stack>
      ) : data && (
        <>
          {/* ═══ TODAY'S OPERATIONS ═══ */}
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            Today's Operations
          </Typography>

          {/* Completion progress */}
          <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Call completion</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: completionRate >= 90 ? '#22C55E' : completionRate >= 70 ? '#F59E0B' : '#EF4444' }}>
                {completionRate}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={completionRate}
              sx={{
                height: 8, borderRadius: 4, bgcolor: '#F1F5F9',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  bgcolor: completionRate >= 90 ? '#22C55E' : completionRate >= 70 ? '#F59E0B' : '#EF4444',
                },
              }}
            />
            <Stack direction="row" gap={2} sx={{ mt: 1.5 }} flexWrap="wrap">
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {data.completed_today} completed of {data.total_today} total
              </Typography>
              {data.carers_working_today > 0 && (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {data.carers_working_today} carer{data.carers_working_today !== 1 ? 's' : ''} working
                </Typography>
              )}
            </Stack>
          </Paper>

          {/* Today's alert cards — equal height */}
          <Grid container spacing={1.5} sx={{ mb: 3 }} alignItems="stretch">
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<MissedIcon sx={{ color: '#DC2626', fontSize: 20 }} />} label="Missed today" value={data.missed_today}
                color="#DC2626" bg="#FEF2F2" onClick={() => nav('/homecare?status=missed')} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<UnassignedIcon sx={{ color: '#F59E0B', fontSize: 20 }} />} label="Unassigned today" value={data.unassigned_today}
                color="#F59E0B" bg="#FFFBEB" subtitle={`${data.unassigned_upcoming} upcoming`} onClick={() => nav('/call-assignment')} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<OverdueIcon sx={{ color: '#EF4444', fontSize: 20 }} />} label="Overdue calls" value={data.overdue_calls}
                color="#EF4444" bg="#FEF2F2" onClick={() => nav('/homecare?status=scheduled')} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<CompletedIcon sx={{ color: '#22C55E', fontSize: 20 }} />} label="Completed today" value={data.completed_today}
                color="#22C55E" bg="#F0FDF4" onClick={() => nav('/homecare?status=completed')} />
            </Grid>
          </Grid>

          {/* ═══ COMPLIANCE & SAFETY ═══ */}
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            Compliance & Safety
          </Typography>

          <Grid container spacing={1.5} sx={{ mb: 3 }} alignItems="stretch">
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<ComplianceIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />} label="Training expiring" value={data.training_expiring}
                color="#8B5CF6" bg="#F5F3FF" subtitle="Within 14 days" onClick={() => nav('/compliance/homecare')} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<ComplianceIcon sx={{ color: '#6366F1', fontSize: 20 }} />} label="Docs expiring" value={data.docs_expiring}
                color="#6366F1" bg="#EEF2FF" subtitle="DBS, passport, visa" onClick={() => nav('/compliance/homecare')} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<IncidentIcon sx={{ color: '#EF4444', fontSize: 20 }} />} label="Open incidents" value={data.open_incidents}
                color="#EF4444" bg="#FEF2F2" onClick={() => nav('/incidents')} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} sx={{ display: 'flex' }}>
              <AlertCard icon={<CarePlanIcon sx={{ color: '#F59E0B', fontSize: 20 }} />} label="Care plans overdue" value={data.overdue_care_plans}
                color="#F59E0B" bg="#FFFBEB" onClick={() => nav('/people')} />
            </Grid>
          </Grid>

          {/* ═══ MISSED CALL TREND ═══ */}
          {data.missed_trend.length > 0 && (
            <>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Missed Calls — Last 7 Days
              </Typography>
              <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                <Stack direction="row" gap={1} alignItems="flex-end" sx={{ height: 120 }}>
                  {data.missed_trend.map((d) => {
                    const maxCount = Math.max(...data.missed_trend.map(x => x.count), 1)
                    const barHeight = Math.max((d.count / maxCount) * 100, d.count > 0 ? 12 : 4)
                    return (
                      <Tooltip key={d.day} title={`${d.day}: ${d.count} missed`}>
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: d.count > 0 ? '#334155' : '#CBD5E1' }}>
                            {d.count}
                          </Typography>
                          <Box sx={{
                            width: '100%', height: barHeight, borderRadius: 1,
                            bgcolor: d.count > 3 ? '#EF4444' : d.count > 1 ? '#F59E0B' : d.count > 0 ? '#CBD5E1' : '#F1F5F9',
                            transition: 'height 0.3s', minHeight: 4,
                          }} />
                        </Box>
                      </Tooltip>
                    )
                  })}
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>7 days ago</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Today</Typography>
                </Stack>
              </Paper>
            </>
          )}

          {/* ═══ MISSED BY CARER ═══ */}
          {data.missed_by_carer.length > 0 && (
            <>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Missed Calls by Carer — Last 7 Days
              </Typography>
              <Stack gap={1} sx={{ mb: 3 }}>
                {data.missed_by_carer.map((c) => (
                  <Paper key={c.carer_name} elevation={0} sx={{
                    border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden',
                  }}>
                    <Box
                      onClick={() => setExpandedCarer(expandedCarer === c.carer_name ? null : c.carer_name)}
                      sx={{
                        p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background 0.15s',
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: '50%', bgcolor: '#FEF2F2',
                          display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.7rem', color: '#DC2626',
                        }}>{c.carer_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.carer_name}</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Chip label={`${c.count} missed`} size="small"
                          sx={{ bgcolor: c.count > 3 ? '#FEF2F2' : '#FFFBEB', color: c.count > 3 ? '#B91C1C' : '#D97706', fontWeight: 600, fontSize: '0.7rem' }} />
                        {expandedCarer === c.carer_name ? <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />}
                      </Stack>
                    </Box>
                    <Collapse in={expandedCarer === c.carer_name}>
                      <Box sx={{ px: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Stack spacing={1} sx={{ pt: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              {c.count} call{c.count !== 1 ? 's' : ''} missed in the last 7 days
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              Review individual call records for reasons and follow-up actions
                            </Typography>
                          </Stack>
                          <Button
                            size="small"
                            onClick={(e) => { e.stopPropagation(); nav(`/homecare?status=missed&carer=${encodeURIComponent(c.carer_name)}`) }}
                            sx={{ textTransform: 'none', color: '#DC2626', fontWeight: 600, fontSize: '0.78rem', justifyContent: 'flex-start', px: 0 }}
                            startIcon={<GotoIcon sx={{ fontSize: 14 }} />}
                          >
                            View missed calls for {c.carer_name.split(' ')[0]}
                          </Button>
                        </Stack>
                      </Box>
                    </Collapse>
                  </Paper>
                ))}
              </Stack>
            </>
          )}

        </>
      )}
    </PageContainer>
  )
}
