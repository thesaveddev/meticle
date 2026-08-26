import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Grid, Card, CardContent, Stack, Chip, IconButton,
  Skeleton, Divider, Tooltip,
} from '@mui/material'
import {
  Warning as CriticalIcon,
  Error as HighIcon,
  Info as MediumIcon,
  CheckCircle as LowIcon,
  Medication as MedsIcon,
  Group as StaffingIcon,
  Verified as ComplianceIcon,
  Favorite as CareIcon,
  Close as DismissIcon,
  Refresh as RefreshIcon,
  OpenInNew as GotoIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import PageMeta from '../../components/PageMeta'

interface AlertSummary {
  alerts: { critical: number; high: number; medium: number; low: number; total: number }
  categories: { medication: number; staffing_safety: number; compliance: number; care: number }
  overdue_medications: number
  unfilled_shifts: number
  expiring_training: number
  expiring_dbs: number
  overdue_care_plan_reviews: number
  overdue_policy_reviews: number
  low_fluid_intake: number
  overdue_incident_actions: number
}

interface Alert {
  id: string
  alert_type: string
  aggregate_id: string
  severity: string
  title: string
  message: string
  link: string
  person_id: string | null
  reference_id: string | null
  dismissed: boolean
  created_at: string
  updated_at: string
}

const severityColor = (s: string) => {
  switch (s) {
    case 'critical': return { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B', icon: '#DC2626' }
    case 'high': return { bg: '#FFFBEB', border: '#D97706', text: '#92400E', icon: '#D97706' }
    case 'medium': return { bg: '#F0F9FF', border: '#2563EB', text: '#1E40AF', icon: '#2563EB' }
    case 'low': return { bg: '#F8FAFC', border: '#6B7280', text: '#4B5563', icon: '#9CA3AF' }
    default: return { bg: '#F8FAFC', border: '#9CA3AF', text: '#4B5563', icon: '#9CA3AF' }
  }
}

const SeverityIcon = ({ severity }: { severity: string }) => {
  const c = severityColor(severity)
  switch (severity) {
    case 'critical': return <CriticalIcon sx={{ color: c.icon, fontSize: 20 }} />
    case 'high': return <HighIcon sx={{ color: c.icon, fontSize: 20 }} />
    case 'medium': return <MediumIcon sx={{ color: c.icon, fontSize: 20 }} />
    case 'low': return <LowIcon sx={{ color: c.icon, fontSize: 20 }} />
    default: return <MediumIcon sx={{ color: c.icon, fontSize: 20 }} />
  }
}

const categoryLabel = (type: string): string => {
  if (type.startsWith('medication.')) return 'Medication'
  if (type === 'shift.unfilled') return 'Staffing'
  if (type === 'incident.action_overdue') return 'Safety'
  if (type === 'training.expiring') return 'Training'
  if (type === 'dbs.expiring') return 'DBS'
  if (type === 'policy.review_due') return 'Policy'
  if (type === 'care_plan.review_due') return 'Care Plan'
  if (type === 'fluid.intake_below_target') return 'Health'
  return type
}

export default function MissionControlPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        api.get('/mission-control/summary'),
        api.get('/mission-control/alerts'),
      ])
      setSummary(summaryRes.data)
      setAlerts(alertsRes.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDismiss = async (id: string) => {
    setDismissing(prev => new Set(prev).add(id))
    try {
      await api.patch(`/mission-control/alerts/${id}/dismiss`)
      setAlerts(prev => prev.filter(a => a.id !== id))
      setSummary(prev => prev ? {
        ...prev,
        alerts: { ...prev.alerts, total: prev.alerts.total - 1, [alerts.find(a => a.id === id)?.severity || 'low']: Math.max(0, (prev.alerts as any)[alerts.find(a => a.id === id)?.severity || 'low'] - 1) }
      } : null)
    } catch {
      // silent
    } finally {
      setDismissing(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const severityCounts = summary?.alerts || { critical: 0, high: 0, medium: 0, low: 0, total: 0 }

  if (loading) {
    return (
      <Box>
        <PageMeta title="Mission Control" description="Operational overview of everything that needs attention across medication, staffing, compliance, and care reviews." />
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Mission Control</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>Operational overview of everything that needs attention.</Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[1,2,3,4].map(i => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
        {[1,2,3].map(i => (
          <Skeleton key={i} variant="rectangular" height={72} sx={{ mb: 2, borderRadius: 2 }} />
        ))}
      </Box>
    )
  }

  return (
    <Box>
      <PageMeta title="Mission Control" description="Operational overview of everything that needs attention across medication, staffing, compliance, and care reviews." />

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Mission Control</Typography>
          <Typography variant="body1" color="text.secondary">
            Everything that needs attention, in one place.
          </Typography>
        </Box>
        <IconButton onClick={fetchData} size="small" sx={{ bgcolor: 'action.hover' }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Severity Bar */}
      <Paper elevation={0} sx={{
        p: 2.5, mb: 3, borderRadius: 2,
        bgcolor: severityCounts.critical > 0 ? '#FEF2F2' : severityCounts.high > 0 ? '#FFFBEB' : '#F8FAFC',
        border: `1px solid ${severityCounts.critical > 0 ? '#FECACA' : severityCounts.high > 0 ? '#FDE68A' : '#E2E8F0'}`,
      }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={6} md={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: severityCounts.critical > 0 ? '#DC2626' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: severityCounts.critical > 0 ? '#fff' : '#6B7280' }}>{severityCounts.critical}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>Critical</Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={6} md={3}>
            <Stack direction="row" spacing={1.5}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: severityCounts.high > 0 ? '#D97706' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: severityCounts.high > 0 ? '#fff' : '#6B7280' }}>{severityCounts.high}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>High</Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={6} md={3}>
            <Stack direction="row" spacing={1.5}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: severityCounts.medium > 0 ? '#2563EB' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: severityCounts.medium > 0 ? '#fff' : '#6B7280' }}>{severityCounts.medium}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mt: 1.5 }}>Medium</Typography>
            </Stack>
          </Grid>
          <Grid item xs={6} md={3}>
            <Stack direction="row" spacing={1.5}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#6B7280' }}>{severityCounts.low}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mt: 1.5 }}>Low</Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Category Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Medication', icon: <MedsIcon />, count: (summary?.categories.medication || 0) + (summary?.overdue_medications || 0), detail: `${summary?.overdue_medications || 0} overdue, ${summary?.categories.medication || 0} alert`, path: '/emedication', color: '#DC2626' },
          { label: 'Staffing & Safety', icon: <StaffingIcon />, count: (summary?.categories.staffing_safety || 0) + (summary?.unfilled_shifts || 0) + (summary?.overdue_incident_actions || 0), detail: `${summary?.unfilled_shifts || 0} unfilled shifts, ${summary?.overdue_incident_actions || 0} open actions`, path: '/scheduling', color: '#D97706' },
          { label: 'Compliance', icon: <ComplianceIcon />, count: (summary?.categories.compliance || 0) + (summary?.expiring_training || 0) + (summary?.expiring_dbs || 0) + (summary?.overdue_policy_reviews || 0), detail: `${summary?.expiring_training || 0} training, ${summary?.expiring_dbs || 0} DBS, ${summary?.overdue_policy_reviews || 0} policies`, path: '/compliance', color: '#2563EB' },
          { label: 'Care Reviews', icon: <CareIcon />, count: (summary?.categories.care || 0) + (summary?.overdue_care_plan_reviews || 0) + (summary?.low_fluid_intake || 0), detail: `${summary?.overdue_care_plan_reviews || 0} care plans, ${summary?.low_fluid_intake || 0} low fluid`, path: '/people', color: '#16A34A' },
        ].map(cat => (
          <Grid item xs={6} md={3} key={cat.label}>
            <Card
              elevation={0}
              sx={{
                cursor: 'pointer', borderRadius: 2,
                border: '1px solid', borderColor: 'divider',
                transition: 'box-shadow 0.2s, border-color 0.2s',
                '&:hover': { boxShadow: '0 4px 12px -4px rgba(0,0,0,0.1)', borderColor: cat.color + '40' },
              }}
              onClick={() => navigate(cat.path)}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{ color: cat.color, mt: 0.25 }}>{cat.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1 }}>{cat.count}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.25 }}>{cat.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{cat.detail}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Alert Feed */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {alerts.length === 0 ? 'All clear — nothing needs attention' : `${alerts.length} open alert${alerts.length > 1 ? 's' : ''}`}
      </Typography>

      {alerts.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <LowIcon sx={{ fontSize: 48, color: '#16A34A', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#16A34A' }}>All clear</Typography>
          <Typography variant="body2" color="text.secondary">No alerts require attention right now.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {alerts.map(alert => {
            const c = severityColor(alert.severity)
            return (
              <Paper
                key={alert.id}
                elevation={0}
                sx={{
                  p: 2, borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${c.border}40`,
                  borderLeft: `4px solid ${c.border}`,
                  bgcolor: c.bg,
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: '0 2px 8px -2px rgba(0,0,0,0.08)' },
                  opacity: dismissing.has(alert.id) ? 0.5 : 1,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{ mt: 0.25 }}>
                    <SeverityIcon severity={alert.severity} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        label={categoryLabel(alert.alert_type)}
                        size="small"
                        sx={{
                          fontSize: '0.65rem', fontWeight: 700, height: 20,
                          bgcolor: `${c.border}18`, color: c.text,
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                      {alert.severity === 'critical' && (
                        <Chip label="Critical" size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, height: 20, bgcolor: '#DC262610', color: '#DC2626' }} />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{alert.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{alert.message}</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    {alert.link && (
                      <Tooltip title="Go to detail">
                        <IconButton size="small" onClick={() => navigate(alert.link)}>
                          <GotoIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Dismiss">
                      <IconButton size="small" onClick={() => handleDismiss(alert.id)} disabled={dismissing.has(alert.id)}>
                        <DismissIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}