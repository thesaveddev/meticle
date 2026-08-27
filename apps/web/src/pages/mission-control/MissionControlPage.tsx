import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Grid, Card, CardContent, Stack, Chip, IconButton,
  Skeleton, Divider, Tooltip, Tab, Tabs, Button, Select, MenuItem,
  FormControl, InputLabel, Snackbar, Alert as MuiAlert,
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
  FilterList as FilterIcon,
  History as HistoryIcon,
  TrendingUp as TrendIcon,
  PersonAdd as AssignIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import PageMeta from '../../components/PageMeta'

interface AlertSummary {
  alerts: { critical: number; high: number; medium: number; low: number; total: number }
  categories: { medication: number; staffing_safety: number; compliance: number; care: number }
  overdue_medications: number
  unfilled_shifts: number
  understaffed_shifts: number
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
  assigned_to: string | null
  assigned_name: string | null
  dismissed: boolean
  created_at: string
  updated_at: string
}

interface TrendData {
  daily: { date: string; critical: number; high: number; medium: number; low: number; total: number }[]
  this_week: { total: number; critical: number; high: number; medium: number; low: number }
  last_week: { total: number; critical: number; high: number; medium: number; low: number }
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
  if (type === 'shift.unfilled' || type === 'shift.understaffed') return 'Staffing'
  if (type === 'incident.action_overdue') return 'Safety'
  if (type === 'training.expiring') return 'Training'
  if (type === 'dbs.expiring') return 'DBS'
  if (type === 'policy.review_due') return 'Policy'
  if (type === 'care_plan.review_due') return 'Care Plan'
  if (type === 'fluid.intake_below_target') return 'Health'
  if (type.startsWith('nutrition.')) return 'Nutrition'
  return type
}


export default function MissionControlPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [history, setHistory] = useState<Alert[]>([])
  const [trends, setTrends] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [staff, setStaff] = useState<any[]>([])
  const [assignDialog, setAssignDialog] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

  const userStr = localStorage.getItem('user')
  let rawUser: any = {}
  try { rawUser = userStr ? JSON.parse(userStr) : {} } catch { rawUser = {} }
  const isWriteRole = rawUser.role === 'ORG_ADMIN' || rawUser.role === 'MANAGER'

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (severityFilter) params.set('severity', severityFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const qs = params.toString() ? `?${params}` : ''
      const [summaryRes, alertsRes] = await Promise.all([
        api.get('/mission-control/summary'),
        api.get(`/mission-control/alerts${qs}`),
      ])
      setSummary(summaryRes.data)
      setAlerts(alertsRes.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [severityFilter, categoryFilter])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/mission-control/alerts/history')
      setHistory(res.data)
    } catch { /* silent */ }
  }, [])

  const fetchTrends = useCallback(async () => {
    try {
      const res = await api.get('/mission-control/trends')
      setTrends(res.data)
    } catch { /* silent */ }
  }, [])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get('/settings/staff')
      setStaff(res.data || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchAlerts()
    if (tab === 1) fetchHistory()
    if (tab === 2) fetchTrends()
  }, [tab, fetchAlerts, fetchHistory, fetchTrends])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const handleDismiss = async (id: string) => {
    setDismissing(prev => new Set(prev).add(id))
    try {
      await api.patch(`/mission-control/alerts/${id}/dismiss`)
      setAlerts(prev => prev.filter(a => a.id !== id))
      setSummary(prev => prev ? { ...prev, alerts: { ...prev.alerts, total: prev.alerts.total - 1 } } : null)
    } catch { /* silent */ } finally { setDismissing(prev => { const next = new Set(prev); next.delete(id); return next }) }
  }

  const handleBatchDismiss = async () => {
    if (selected.size === 0) return
    try {
      await api.patch('/mission-control/alerts/batch-dismiss', { ids: Array.from(selected) })
      setAlerts(prev => prev.filter(a => !selected.has(a.id)))
      setSelected(new Set())
      setSnackbar({ open: true, msg: `Dismissed ${selected.size} alerts`, sev: 'success' })
      fetchAlerts()
    } catch { setSnackbar({ open: true, msg: 'Failed to dismiss', sev: 'error' }) }
  }

  const handleAssign = async (alertId: string, userId: string, userName: string) => {
    try {
      await api.patch(`/mission-control/alerts/${alertId}/assign`, { assignedTo: userId, assignedName: userName })
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, assigned_to: userId, assigned_name: userName } : a))
      setAssignDialog(null)
      setSnackbar({ open: true, msg: `Assigned to ${userName}`, sev: 'success' })
    } catch { setSnackbar({ open: true, msg: 'Failed to assign', sev: 'error' }) }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const selectAll = () => {
    if (selected.size === alerts.length) { setSelected(new Set()) } else { setSelected(new Set(alerts.map(a => a.id))) }
  }

  const severityCounts = summary?.alerts || { critical: 0, high: 0, medium: 0, low: 0, total: 0 }

  const trendDelta = (field: string) => {
    if (!trends) return null
    const curr = (trends.this_week as any)[field] || 0
    const prev = (trends.last_week as any)[field] || 0
    if (prev === 0) return curr > 0 ? '+100%' : '0%'
    const pct = Math.round(((curr - prev) / prev) * 100)
    return pct > 0 ? `+${pct}%` : `${pct}%`
  }

  if (loading && tab === 0) {
    return (
      <Box>
        <PageMeta title="Mission Control" description="Operational overview of everything that needs attention across medication, staffing, compliance, and care reviews." />
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Mission Control</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>Operational overview of everything that needs attention.</Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>{[1,2,3,4].map(i => (<Grid item xs={6} md={3} key={i}><Skeleton variant="rectangular" height={96} sx={{ borderRadius: 2 }} /></Grid>))}</Grid>
        {[1,2,3].map(i => (<Skeleton key={i} variant="rectangular" height={72} sx={{ mb: 2, borderRadius: 2 }} />))}
      </Box>
    )
  }

  return (
    <Box>
      <PageMeta title="Mission Control" description="Operational overview of everything that needs attention across medication, staffing, compliance, and care reviews." />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Mission Control</Typography>
          <Typography variant="body1" color="text.secondary">Everything that needs attention, in one place.</Typography>
        </Box>
        <IconButton onClick={fetchAlerts} size="small" sx={{ bgcolor: 'action.hover' }}><RefreshIcon fontSize="small" /></IconButton>
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<FilterIcon />} iconPosition="start" label="Active Alerts" />
        <Tab icon={<HistoryIcon />} iconPosition="start" label={`History (${history.length})`} />
        <Tab icon={<TrendIcon />} iconPosition="start" label="Trends" />
      </Tabs>

      {/* === TAB 0: Active Alerts === */}
      {tab === 0 && (
        <>
          {/* Severity Bar */}
          <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: severityCounts.critical > 0 ? '#FEF2F2' : severityCounts.high > 0 ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${severityCounts.critical > 0 ? '#FECACA' : severityCounts.high > 0 ? '#FDE68A' : '#E2E8F0'}` }}>
            <Grid container spacing={2} alignItems="center">
              {[{ label: 'Critical', val: severityCounts.critical, color: '#DC2626' }, { label: 'High', val: severityCounts.high, color: '#D97706' }, { label: 'Medium', val: severityCounts.medium, color: '#2563EB' }, { label: 'Low', val: severityCounts.low, color: '#9CA3AF' }].map(s => (
                <Grid item xs={6} md={3} key={s.label}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: s.val > 0 ? s.color : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: s.val > 0 ? '#fff' : '#6B7280' }}>{s.val}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Category Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[{ label: 'Medication', icon: <MedsIcon />, count: (summary?.categories.medication || 0) + (summary?.overdue_medications || 0), detail: `${summary?.overdue_medications || 0} overdue`, path: '/emedication', color: '#DC2626' },
              { label: 'Staffing & Safety', icon: <StaffingIcon />, count: (summary?.categories.staffing_safety || 0) + (summary?.unfilled_shifts || 0) + (summary?.understaffed_shifts || 0) + (summary?.overdue_incident_actions || 0), detail: `${summary?.unfilled_shifts || 0} unfilled, ${summary?.understaffed_shifts || 0} understaffed`, path: '/scheduling', color: '#D97706' },
              { label: 'Compliance', icon: <ComplianceIcon />, count: (summary?.categories.compliance || 0) + (summary?.expiring_training || 0) + (summary?.expiring_dbs || 0) + (summary?.overdue_policy_reviews || 0), detail: `${summary?.expiring_training || 0} training, ${summary?.expiring_dbs || 0} DBS`, path: '/compliance', color: '#2563EB' },
              { label: 'Care Reviews', icon: <CareIcon />, count: (summary?.categories.care || 0) + (summary?.overdue_care_plan_reviews || 0) + (summary?.low_fluid_intake || 0), detail: `${summary?.overdue_care_plan_reviews || 0} care plans`, path: '/people', color: '#16A34A' },
            ].map(cat => (
              <Grid item xs={6} md={3} key={cat.label}>
                <Card elevation={0} sx={{ cursor: 'pointer', borderRadius: 2, border: '1px solid', borderColor: 'divider', transition: 'box-shadow 0.2s, border-color 0.2s', '&:hover': { boxShadow: '0 4px 12px -4px rgba(0,0,0,0.1)', borderColor: cat.color + '40' } }} onClick={() => navigate(cat.path)}>
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

          {/* Filters + Batch Actions */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
              <FilterIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Severity</InputLabel>
                <Select value={severityFilter} label="Severity" onChange={e => setSeverityFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Category</InputLabel>
                <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="medication">Medication</MenuItem>
                  <MenuItem value="staffing">Staffing</MenuItem>
                  <MenuItem value="safety">Safety</MenuItem>
                  <MenuItem value="compliance">Compliance</MenuItem>
                  <MenuItem value="care">Care</MenuItem>
                </Select>
              </FormControl>
              {(severityFilter || categoryFilter) && (
                <Button size="small" onClick={() => { setSeverityFilter(''); setCategoryFilter('') }} sx={{ textTransform: 'none', color: 'text.secondary' }}>Clear</Button>
              )}
            </Stack>
            {isWriteRole && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" onClick={selectAll} sx={{ textTransform: 'none' }}>{selected.size === alerts.length ? 'Deselect all' : 'Select all'}</Button>
                {selected.size > 0 && (
                  <Button size="small" color="error" startIcon={<DoneAllIcon />} onClick={handleBatchDismiss} sx={{ textTransform: 'none' }}>
                    Dismiss {selected.size}
                  </Button>
                )}
              </Stack>
            )}
          </Stack>

          <Divider sx={{ mb: 3 }} />

          {/* Alert Feed */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {alerts.length === 0 ? 'All clear - nothing needs attention' : `${alerts.length} open alert${alerts.length > 1 ? 's' : ''}`}
          </Typography>

          {alerts.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <LowIcon sx={{ fontSize: 48, color: '#16A34A', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#16A34A' }}>All clear</Typography>
              <Typography variant="body2" color="text.secondary">No alerts require attention right now.</Typography>
            </Paper>
          ) : (
            <Stack spacing={1}>
              {alerts.map(alert => {
                const c = severityColor(alert.severity)
                const isChecked = selected.has(alert.id)
                return (
                  <Paper key={alert.id} elevation={0} sx={{ p: 2, borderRadius: 2, cursor: 'pointer', border: `1px solid ${isChecked ? c.border : c.border + '40'}`, borderLeft: `4px solid ${c.border}`, bgcolor: isChecked ? c.bg : 'background.paper', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 2px 8px -2px rgba(0,0,0,0.08)' }, opacity: dismissing.has(alert.id) ? 0.5 : 1 }} onClick={() => isWriteRole && toggleSelect(alert.id)}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box sx={{ mt: 0.25 }}><SeverityIcon severity={alert.severity} /></Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Chip label={categoryLabel(alert.alert_type)} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, height: 20, bgcolor: `${c.border}18`, color: c.text, '& .MuiChip-label': { px: 1 } }} />
                          {alert.severity === 'critical' && <Chip label="Critical" size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, height: 20, bgcolor: '#DC262610', color: '#DC2626' }} />}
                          {alert.assigned_name && <Chip label={`Assigned: ${alert.assigned_name}`} size="small" sx={{ fontSize: '0.6rem', fontWeight: 600, height: 18, bgcolor: '#F1F5F9', color: '#475569' }} />}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{alert.title}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{alert.message}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.65rem' }}>
                          {new Date(alert.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                        {alert.link && <Tooltip title="Go to detail"><IconButton size="small" onClick={() => navigate(alert.link)}><GotoIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></IconButton></Tooltip>}
                        {isWriteRole && <Tooltip title="Assign"><IconButton size="small" onClick={() => setAssignDialog(alert.id)}><AssignIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></IconButton></Tooltip>}
                        {isWriteRole && <Tooltip title="Dismiss"><IconButton size="small" onClick={() => handleDismiss(alert.id)} disabled={dismissing.has(alert.id)}><DismissIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></IconButton></Tooltip>}
                      </Stack>
                    </Stack>

                    {/* Assign Dropdown */}
                    {assignDialog === alert.id && (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1, border: '1px solid #E2E8F0' }} onClick={e => e.stopPropagation()}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>Assign to staff member:</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {staff.slice(0, 8).map((s: any) => (
                            <Chip key={s.id} label={`${s.first_name || ''} ${s.last_name || ''}`} size="small" onClick={() => handleAssign(alert.id, s.user_id || s.id, `${s.first_name || ''} ${s.last_name || ''}`)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#E0E7FF' } }} />
                          ))}
                          <Chip label="Cancel" size="small" onClick={() => setAssignDialog(null)} sx={{ cursor: 'pointer' }} />
                        </Stack>
                      </Box>
                    )}
                  </Paper>
                )
              })}
            </Stack>
          )}
        </>
      )}

      {/* === TAB 1: History === */}
      {tab === 1 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Recently dismissed alerts. These are kept for audit purposes.</Typography>
          {history.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <HistoryIcon sx={{ fontSize: 48, color: '#9CA3AF', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>No history yet</Typography>
              <Typography variant="body2" color="text.secondary">Dismissed alerts will appear here.</Typography>
            </Paper>
          ) : (
            <Stack spacing={1}>
              {history.map(alert => {
                const c = severityColor(alert.severity)
                return (
                  <Paper key={alert.id} elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid #E2E8F0`, borderLeft: `4px solid ${c.border}40`, opacity: 0.7 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box sx={{ mt: 0.25 }}><SeverityIcon severity={alert.severity} /></Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Chip label={categoryLabel(alert.alert_type)} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, height: 20, bgcolor: '#F1F5F9', color: '#6B7280', '& .MuiChip-label': { px: 1 } }} />
                          <Chip label="Dismissed" size="small" sx={{ fontSize: '0.6rem', fontWeight: 600, height: 18, bgcolor: '#F0FDF4', color: '#16A34A' }} />
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{alert.title}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{alert.message}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.65rem' }}>
                          Dismissed {new Date(alert.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </>
      )}

      {/* === TAB 2: Trends === */}
      {tab === 2 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Week-over-week alert volume comparison.</Typography>
          {trends && (
            <>
              {/* Week Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {[{ label: 'This Week', data: trends.this_week, color: '#0F4C81' }, { label: 'Last Week', data: trends.last_week, color: '#6B7280' }].map(w => (
                  <Grid item xs={12} md={6} key={w.label}>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 2, borderLeft: `4px solid ${w.color}` }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: w.color, mb: 2 }}>{w.label}</Typography>
                      <Grid container spacing={2}>
                        {[{ l: 'Total', v: w.data.total, c: w.color }, { l: 'Critical', v: w.data.critical, c: '#DC2626' }, { l: 'High', v: w.data.high, c: '#D97706' }, { l: 'Medium', v: w.data.medium, c: '#2563EB' }].map(s => (
                          <Grid item xs={6} sm={3} key={s.l}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: s.c }}>{s.v}</Typography>
                              <Typography variant="caption" color="text.secondary">{s.l}</Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Delta Row */}
              <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Change vs Last Week</Typography>
                <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
                  {[{ l: 'Total', f: 'total' }, { l: 'Critical', f: 'critical' }, { l: 'High', f: 'high' }, { l: 'Medium', f: 'medium' }].map(d => {
                    const delta = trendDelta(d.f)
                    const isUp = delta?.startsWith('+') && delta !== '+0%'
                    const isDown = delta?.startsWith('-')
                    return (
                      <Box key={d.f}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.l}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: isUp ? '#DC2626' : isDown ? '#16A34A' : '#6B7280' }}>{delta}</Typography>
                      </Box>
                    )
                  })}
                </Stack>
              </Paper>

              {/* Daily Breakdown */}
              {trends.daily.length > 0 && (
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Daily Alert Count (14 days)</Typography>
                  <Stack spacing={0.5}>
                    {trends.daily.map(day => {
                      const maxVal = Math.max(...trends.daily.map(d => d.total), 1)
                      return (
                        <Stack key={day.date} direction="row" spacing={2} alignItems="center">
                          <Typography variant="caption" sx={{ width: 70, color: 'text.secondary', fontWeight: 600 }}>
                            {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                          </Typography>
                          <Box sx={{ flex: 1, height: 20, bgcolor: '#F1F5F9', borderRadius: 1, overflow: 'hidden', display: 'flex' }}>
                            {day.critical > 0 && <Box sx={{ width: `${(day.critical / maxVal) * 100}%`, bgcolor: '#DC2626' }} />}
                            {day.high > 0 && <Box sx={{ width: `${(day.high / maxVal) * 100}%`, bgcolor: '#D97706' }} />}
                            {day.medium > 0 && <Box sx={{ width: `${(day.medium / maxVal) * 100}%`, bgcolor: '#2563EB' }} />}
                            {day.low > 0 && <Box sx={{ width: `${(day.low / maxVal) * 100}%`, bgcolor: '#9CA3AF' }} />}
                          </Box>
                          <Typography variant="caption" sx={{ width: 30, textAlign: 'right', fontWeight: 700 }}>{day.total}</Typography>
                        </Stack>
                      )
                    })}
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    {[{ l: 'Critical', c: '#DC2626' }, { l: 'High', c: '#D97706' }, { l: 'Medium', c: '#2563EB' }, { l: 'Low', c: '#9CA3AF' }].map(l => (
                      <Stack key={l.l} direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: l.c }} />
                        <Typography variant="caption" color="text.secondary">{l.l}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              )}
            </>
          )}
        </>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <MuiAlert severity={snackbar.sev} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.msg}</MuiAlert>
      </Snackbar>
    </Box>
  )
}
