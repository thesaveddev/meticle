import { useEffect, useState } from 'react'
import { Grid, Typography, Box, Stack, LinearProgress, Divider, Button, List, ListItem, CircularProgress, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import DomiciliaryDashboard from './DomiciliaryDashboard'
import {
  TrendingUp as TrendingUpIcon,
  Group as PeopleIcon,
  AssignmentLate as AlertIcon,
  CheckCircle as VerifiedIcon,
  Schedule as ScheduleIcon,
  Schedule as ClockIcon,
  ArrowForward as ArrowIcon,
  Home as HomeIcon,
  BadgeOutlined as BadgeIcon,
  SchoolOutlined as SchoolIcon,
  EventBusy as LeaveIcon,
  WarningAmber as WarningIcon,
  CreditCard as CreditCardIcon,
  LocationOn as LocationIcon,
  Medication as MedIcon,
  Checklist as CompetencyIcon,
  Star as SatisfactionIcon,
  ReportProblem as IncidentIcon,
  TrendingDown as ComplianceDownIcon,
} from '@mui/icons-material'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'
import { PremiumCard, StatCard, SectionHeader } from '../../components/design/PremiumCard'

interface DashboardStats {
  total_staff: number
  compliance_rate: number
  open_shifts: number
  agency_saved: number
  active_people: number
  staff_on_duty: number
  open_incidents: number
  locations: number
}

interface DashboardWidgets {
  dbs_expiring_soon: number
  training_expiring_soon: number
  pending_leave_requests: number
  unread_notifications: number
  overdue_medications: number
  competency_due: number
  staff_below_threshold: number
  open_severe_incidents: number
  satisfaction_avg: number | null
  satisfaction_total: number
  compliance_breakdown: { total_active: number; compliant_count: number; below_threshold: number }
}

interface ComplianceItem {
  label: string
  val: number
  color: string
}

interface RotaItem {
  id: string
  start_time: string
  end_time: string
  status: string
  location_name: string
  assigned_staff: string
}

interface AppointmentItem {
  id: string
  title: string
  start_time: string
  end_time: string
  status: string
  location_name: string
  staff_name: string
  person_name: string
}

const ONBOARDING_STEPS_BY_KEY = 'meticle_onboarding_dismissed_'

export default function DashboardPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [widgets, setWidgets] = useState<DashboardWidgets | null>(null)
  const [compliance, setCompliance] = useState<ComplianceItem[]>([])
  const [todayRota, setTodayRota] = useState<RotaItem[]>([])
  const [todayAppointments, setTodayAppointments] = useState<AppointmentItem[]>([])
  const userStr = localStorage.getItem('user')
  let rawUser: any = {}
  try { rawUser = userStr ? JSON.parse(userStr) : {} } catch { rawUser = {} }
  const firstName = rawUser.first_name || rawUser.email?.split('@')[0] || 'Admin'
  const isStaff = rawUser.role === UserRole.CARE_WORKER
  const isAdmin = rawUser.role === UserRole.ORG_ADMIN

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const [org, setOrg] = useState<any>(null)
  const [domiciliaryData, setDomiciliaryData] = useState<any>(null)
  const orgId = rawUser.organization_id || rawUser.organizationId
  const serviceTypes: string[] = org?.service_types || ['supported_living']
  const [hideOnboarding, setHideOnboarding] = useState(() => {
    try { return orgId ? localStorage.getItem(ONBOARDING_STEPS_BY_KEY + orgId) === 'true' : false } catch { return false }
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!orgId) {
        setLoading(false)
        return
      }
      try {
        const orgRes = await api.get(`/organizations/${orgId}`)
        const orgData = orgRes.data
        setOrg(orgData)
        localStorage.setItem('organization', JSON.stringify(orgData))
        if (orgData.onboarding_dismissed_at) setHideOnboarding(true)

        const todayStr = new Date().toISOString().split('T')[0]
        if (isStaff) {
          const [rotaRes, aptRes] = await Promise.all([
            api.get('/dashboard/today-rota'),
            api.get(`/appointments?date=${todayStr}`),
          ])
          setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_people: 0, staff_on_duty: 0, open_incidents: 0, locations: 0 })
          setTodayRota(rotaRes.data)
          setTodayAppointments(aptRes.data)
        } else {
          const [statsRes, complianceRes, rotaRes, widgetsRes, aptRes] = await Promise.all([
            api.get('/dashboard/stats'),
            api.get('/dashboard/compliance'),
            api.get('/dashboard/today-rota'),
            api.get('/dashboard/widgets'),
            api.get(`/appointments?date=${todayStr}`),
          ])
          setStats(statsRes.data)
          setCompliance(complianceRes.data)
          setTodayRota(rotaRes.data)
          setWidgets(widgetsRes.data)
          setTodayAppointments(aptRes.data)
          const types = orgRes.data?.service_types || []
          if (types.includes('domiciliary') || types.includes('live_in')) {
            api.get('/dashboard/domiciliary').then(res => setDomiciliaryData(res.data)).catch(() => {})
          }
        }
      } catch {
        setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_people: 0, staff_on_duty: 0, open_incidents: 0, locations: 0 })
        setCompliance([
          { label: 'Mandatory Training', val: 0, color: '#10B981' },
          { label: 'DBS Verifications', val: 0, color: '#10B981' },
          { label: 'Identity Checks', val: 0, color: '#D97706' },
        ])
        setTodayRota([])
      }
      setLoading(false)
    }
    fetchData()
  }, [orgId])

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  // If this is a domiciliary care organisation, show the dedicated dom care dashboard
  if (serviceTypes.includes('domiciliary') && !isStaff) {
    return <DomiciliaryDashboard />
  }

  const statCards = isStaff
    ? [
        { label: 'My Shifts Today', value: String(todayRota.length), color: '#1A2332', icon: <ScheduleIcon /> },
      ]
    : [
        { label: 'Total Staff', value: String(stats?.total_staff ?? 0), color: '#1A2332', icon: <PeopleIcon />, path: '/staff' },
        { label: 'Active People', value: String(stats?.active_people ?? 0), color: '#1A2332', icon: <HomeIcon />, path: '/people' },
        { label: 'Staff on Duty', value: String(stats?.staff_on_duty ?? 0), color: '#10B981', icon: <BadgeIcon /> },
        { label: 'Compliance Rate', value: `${stats?.compliance_rate ?? 0}%`, color: '#10B981', icon: <VerifiedIcon />, path: '/compliance' },
        { label: 'Open Shifts', value: String(stats?.open_shifts ?? 0), color: '#D97706', icon: <AlertIcon />, path: '/shift-marketplace' },
        { label: 'Alerts', value: String(stats?.open_incidents ?? 0), color: (stats?.open_incidents ?? 0) > 0 ? '#DC2626' : '#10B981', icon: <WarningIcon />, path: '/incidents' },
        { label: 'Agency Saved', value: `£${stats?.agency_saved ?? 0}`, color: '#1A2332', icon: <TrendingUpIcon /> },
      ]

  const onboardSteps = [
    { label: 'Add your location', desc: 'Create your first location so your data stays organised by site.', icon: <LocationIcon />, path: '/settings', done: (stats?.locations ?? 0) > 0 },
    { label: 'Invite your team', desc: 'Invite team members. They\'ll receive an email with a link to set their password.', icon: <PeopleIcon />, path: '/staff', done: (stats?.total_staff ?? 0) > 0 },
    { label: 'Add people in your care', desc: 'Add the people you support once your location is set up.', icon: <HomeIcon />, path: '/people', done: (stats?.active_people ?? 0) > 0 },
    { label: 'Choose your plan', desc: 'Pick the plan that fits your service — move from trial to paid in a minute.', icon: <CreditCardIcon />, path: '/billing', done: !!org && !!org.subscription_status && org.subscription_status !== 'trial' },
  ]
  const onboardDone = onboardSteps.filter(s => s.done).length
  const onboardComplete = onboardDone === onboardSteps.length

  const handleOnboardingDismiss = () => {
    setHideOnboarding(true)
    try { if (orgId) localStorage.setItem(ONBOARDING_STEPS_BY_KEY + orgId, 'true') } catch { /* ignore */ }
    if (orgId) api.patch(`/organizations/${orgId}`, { onboarding_dismissed_at: new Date().toISOString() }).catch(() => {})
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
          {greeting}, {firstName} 👋
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          Here's your overview for today.
        </Typography>
      </Box>

      {/* Onboarding Checklist */}
      {isAdmin && org && !hideOnboarding && !onboardComplete && (
        <PremiumCard noBorder accentColor="#1A2332" sx={{ p: 4, mb: 4, bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Welcome — let's get you set up</Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                A few quick steps to make Meticle ready for your team. {onboardDone} of {onboardSteps.length} complete.
              </Typography>
            </Box>
            <Button size="small" sx={{ color: theme.palette.text.secondary, fontWeight: 600, whiteSpace: 'nowrap' }} onClick={handleOnboardingDismiss}>
              I'm all set
            </Button>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={(onboardDone / onboardSteps.length) * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              mb: 3,
              bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#E5E7EB',
              '& .MuiLinearProgress-bar': { bgcolor: '#1A2332' },
            }}
          />
          <Grid container spacing={2}>
            {onboardSteps.map((step, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Box
                  sx={{
                    p: 2.5,
                    bgcolor: step.done ? '#F0FDF4' : theme.palette.background.paper,
                    borderRadius: '14px',
                    border: `1px solid ${step.done ? '#BBF7D0' : theme.palette.divider}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease',
                    '&:hover': { borderColor: '#1A2332' },
                  }}
                  onClick={() => navigate(step.path)}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: step.done ? '#10B98120' : '#1A233210',
                        color: step.done ? '#10B981' : '#1A2332',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                      }}
                    >
                      {step.done ? <VerifiedIcon sx={{ fontSize: 18 }} /> : i + 1}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{step.label}</Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.3 }}>
                        {step.desc}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </PremiumCard>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((stat, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <StatCard
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              onClick={stat.path ? () => navigate(stat.path) : undefined}
            />
          </Grid>
        ))}
      </Grid>

      {/* Domiciliary Care Summary */}
      {domiciliaryData && serviceTypes.includes('domiciliary') && (
        <PremiumCard noBorder accentColor="#10B981" sx={{ p: 4, mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <SectionHeader
              title="Today's Domiciliary Care"
              action={
                <Button size="small" endIcon={<ArrowIcon fontSize="small" />} onClick={() => navigate('/homecare')} sx={{ color: '#10B981', fontWeight: 700, textTransform: 'none' }}>
                  View Homecare
                </Button>
              }
            />
          </Stack>
          <Grid container spacing={2.5}>
            {[
              { label: 'Visits Today', value: domiciliaryData.today_total, color: '#10B981' },
              { label: 'Completed', value: domiciliaryData.today_completed, color: '#10B981' },
              { label: 'In Progress', value: domiciliaryData.today_in_progress, color: '#D97706' },
              { label: 'Exceptions', value: domiciliaryData.today_exceptions, color: domiciliaryData.today_exceptions > 0 ? '#DC2626' : '#10B981' },
            ].map(card => (
              <Grid item xs={6} sm={3} key={card.label}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: card.color }}>{card.value}</Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>{card.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          {domiciliaryData.today_total > 0 && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress
                variant="determinate"
                value={(domiciliaryData.today_completed / domiciliaryData.today_total) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#E5E7EB',
                  '& .MuiLinearProgress-bar': { bgcolor: '#10B981', borderRadius: 4 },
                }}
              />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
                {domiciliaryData.today_completed} of {domiciliaryData.today_total} visits completed
              </Typography>
            </Box>
          )}
        </PremiumCard>
      )}

      {/* Widgets Row */}
      {!isStaff && widgets && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {[
            { label: 'Staff with Expiring Docs', value: widgets.dbs_expiring_soon, icon: <BadgeIcon />, color: widgets.dbs_expiring_soon > 0 ? '#D97706' : '#10B981', path: '/compliance/identity', emptyMsg: 'All documents valid', warnMsg: `${widgets.dbs_expiring_soon} staff expiring soon` },
            { label: 'Training Expiring', value: widgets.training_expiring_soon, icon: <SchoolIcon />, color: widgets.training_expiring_soon > 0 ? '#D97706' : '#10B981', path: '/compliance/training', emptyMsg: 'All training current', warnMsg: `${widgets.training_expiring_soon} records expiring` },
            { label: 'Competency Due', value: widgets.competency_due, icon: <CompetencyIcon />, color: widgets.competency_due > 0 ? '#DC2626' : '#10B981', path: '/compliance/competency', emptyMsg: 'All assessed', warnMsg: `${widgets.competency_due} assessments due` },
            { label: 'Staff Below Threshold', value: widgets.staff_below_threshold, icon: <ComplianceDownIcon />, color: widgets.staff_below_threshold > 0 ? '#DC2626' : '#10B981', path: '/staff', emptyMsg: 'All staff compliant', warnMsg: `${widgets.staff_below_threshold} staff need attention` },
            { label: 'Pending Leave', value: widgets.pending_leave_requests, icon: <LeaveIcon />, color: widgets.pending_leave_requests > 0 ? '#1A2332' : '#10B981', path: '/leave', emptyMsg: 'No pending requests', warnMsg: `${widgets.pending_leave_requests} pending approvals` },
            { label: 'Open Critical Incidents', value: widgets.open_severe_incidents, icon: <IncidentIcon />, color: widgets.open_severe_incidents > 0 ? '#DC2626' : '#10B981', path: '/incidents', emptyMsg: 'No critical incidents', warnMsg: `${widgets.open_severe_incidents} need attention` },
            { label: 'Overdue Medications', value: widgets.overdue_medications, icon: <MedIcon />, color: widgets.overdue_medications > 0 ? '#DC2626' : '#10B981', path: '/emedication', emptyMsg: 'All administered', warnMsg: `${widgets.overdue_medications} doses overdue` },
            widgets.satisfaction_avg != null ? { label: `Satisfaction Rating`, value: widgets.satisfaction_avg, icon: <SatisfactionIcon />, color: (widgets.satisfaction_avg || 0) >= 4 ? '#10B981' : (widgets.satisfaction_avg || 0) >= 3 ? '#D97706' : '#DC2626', path: '/compliance/satisfaction', emptyMsg: 'No surveys yet', warnMsg: `${widgets.satisfaction_total} responses`, format: (v: number) => `${v}/5` } : null,
          ].filter(Boolean).map((w: any, i) => (
            <Grid item xs={6} md={3} key={i}>
              <PremiumCard
                noBorder
                sx={{
                  p: 3,
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': { borderColor: w.color },
                }}
                onClick={(e) => { e.stopPropagation(); navigate(w.path) }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ color: w.color }}>{w.icon}</Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{w.label}</Typography>
                  </Stack>
                  <Chip
                    label={(w.format ? w.format(w.value) : w.value > 0 ? w.value : '0') as any}
                    size="small"
                    sx={{
                      bgcolor: w.value > 0 ? `${w.color}15` : '#10B98120',
                      color: w.value > 0 ? w.color : '#10B981',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                    }}
                  />
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" sx={{ color: w.value > 0 ? w.color : theme.palette.text.secondary, display: 'block' }}>
                  {w.value > 0 ? w.warnMsg : w.emptyMsg}
                </Typography>
              </PremiumCard>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Compliance at a Glance */}
      {!isStaff && widgets?.compliance_breakdown && (
        <PremiumCard noBorder accentColor="#1A2332" sx={{ p: 4, mb: 4 }}>
          <SectionHeader
            title="Compliance at a Glance"
            action={
              <Button size="small" endIcon={<ArrowIcon fontSize="small" />} onClick={() => navigate('/compliance')} sx={{ color: '#1A2332', fontWeight: 700, textTransform: 'none' }}>
                View Full Report
              </Button>
            }
          />
          <Grid container spacing={2.5}>
            {[
              { label: 'Staff Compliant', value: widgets.compliance_breakdown.compliant_count, color: '#1A2332' },
              { label: 'Below Threshold', value: widgets.compliance_breakdown.below_threshold, color: widgets.compliance_breakdown.below_threshold > 0 ? '#DC2626' : '#10B981' },
              { label: 'Competency Due', value: widgets.competency_due, color: widgets.competency_due > 0 ? '#D97706' : '#10B981' },
              { label: 'Open Severe Incidents', value: widgets.open_severe_incidents, color: widgets.open_severe_incidents > 0 ? '#DC2626' : '#10B981' },
            ].map(card => (
              <Grid item xs={6} sm={3} key={card.label}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: card.color }}>{card.value}</Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>{card.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </PremiumCard>
      )}

      <Grid container spacing={3}>
        {/* Compliance Snapshot */}
        {!isStaff && (
          <Grid item xs={12} md={4}>
            <PremiumCard noBorder sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <SectionHeader
                title="Compliance Snapshot"
                subtitle="Overall readiness for inspection"
              />
              <Box sx={{ flexGrow: 1 }}>
                {compliance.length === 0 ? (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 4 }}>
                    No compliance data yet. Start by uploading staff documents.
                  </Typography>
                ) : (
                  <Stack spacing={3}>
                    {compliance.map((item) => (
                      <Box key={item.label}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: item.val > 0 ? item.color : theme.palette.text.secondary }}>
                            {item.val}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={item.val}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                            '& .MuiLinearProgress-bar': { bgcolor: item.val > 0 ? item.color : '#E5E7EB', borderRadius: 4 },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ textAlign: 'center' }}>
                <Button size="small" endIcon={<ArrowIcon fontSize="small" />} sx={{ color: '#1A2332', fontWeight: 700 }} onClick={() => navigate('/compliance')}>
                  View Full Report
                </Button>
              </Box>
            </PremiumCard>
          </Grid>
        )}

        {/* Today's Rota */}
        <Grid item xs={12} md={isStaff ? 12 : 4}>
          <PremiumCard noBorder sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Today's Rota</Typography>
              <Chip
                label={todayRota.length > 0 ? 'Active Now' : 'No Shifts'}
                size="small"
                sx={{
                  bgcolor: todayRota.length > 0 ? '#1A233220' : theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                  color: todayRota.length > 0 ? '#1A2332' : theme.palette.text.secondary,
                  fontWeight: 700,
                  borderRadius: '10px',
                }}
              />
            </Box>
            <Divider />
            {todayRota.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>No shifts scheduled for today.</Typography>
              </Box>
            ) : (
              <List sx={{ pt: 0 }}>
                {todayRota.map((shift, i) => {
                  const timeStr = `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  const statusColor = shift.status === 'filled' ? '#10B981' : shift.status === 'open' ? '#DC2626' : '#6B7280'
                  const statusBg = shift.status === 'filled' ? '#E9F7F0' : shift.status === 'open' ? '#FDECEC' : theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9'

                  return (
                    <Box key={shift.id}>
                      <ListItem sx={{ py: 3, px: 4 }}>
                        <Stack spacing={1.5} sx={{ width: '100%' }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{shift.location_name}</Typography>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ClockIcon sx={{ fontSize: 14 }} /> {timeStr}
                            </Typography>
                          </Stack>
                          {shift.assigned_staff && (
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>{shift.assigned_staff}</Typography>
                          )}
                          <Chip
                            label={shift.status}
                            size="small"
                            sx={{
                              bgcolor: statusBg,
                              color: statusColor,
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              textTransform: 'capitalize',
                              borderRadius: '10px',
                              alignSelf: 'flex-start',
                            }}
                          />
                        </Stack>
                      </ListItem>
                      {i < todayRota.length - 1 && <Divider />}
                    </Box>
                  )
                })}
              </List>
            )}
          </PremiumCard>
        </Grid>

        {/* Today's Appointments */}
        <Grid item xs={12} md={isStaff ? 12 : 4}>
          <PremiumCard noBorder sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Today's Appointments</Typography>
              <Chip
                label={todayAppointments.length > 0 ? `${todayAppointments.length} Total` : 'None'}
                size="small"
                sx={{
                  bgcolor: todayAppointments.length > 0 ? '#E9F7F0' : theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                  color: todayAppointments.length > 0 ? '#10B981' : theme.palette.text.secondary,
                  fontWeight: 700,
                  borderRadius: '10px',
                }}
              />
            </Box>
            <Divider />
            {todayAppointments.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>No appointments scheduled for today.</Typography>
                <Button size="small" sx={{ mt: 2, color: '#1A2332', fontWeight: 700 }} onClick={() => navigate('/appointments')}>Book Appointment</Button>
              </Box>
            ) : (
              <List sx={{ pt: 0 }}>
                {todayAppointments.map((apt, i) => {
                  const timeStr = `${new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  const statusColor = apt.status === 'completed' ? '#10B981' : apt.status === 'cancelled' ? '#DC2626' : '#1A2332'
                  const statusBg = apt.status === 'completed' ? '#E9F7F0' : apt.status === 'cancelled' ? '#FDECEC' : '#1A233220'
                  return (
                    <Box key={apt.id}>
                      <ListItem sx={{ py: 3, px: 4 }}>
                        <Stack spacing={1.5} sx={{ width: '100%' }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{apt.title}</Typography>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ClockIcon sx={{ fontSize: 14 }} /> {timeStr}
                            </Typography>
                          </Stack>
                          {(apt.person_name || apt.staff_name) && (
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                              {apt.person_name}{apt.person_name && apt.staff_name ? ' • ' : ''}{apt.staff_name}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1}>
                            <Chip
                              label={apt.status}
                              size="small"
                              sx={{
                                bgcolor: statusBg,
                                color: statusColor,
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                textTransform: 'capitalize',
                                borderRadius: '10px',
                              }}
                            />
                            {apt.location_name && (
                              <Chip
                                label={apt.location_name}
                                size="small"
                                sx={{
                                  bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
                                  color: theme.palette.text.secondary,
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  borderRadius: '10px',
                                }}
                              />
                            )}
                          </Stack>
                        </Stack>
                      </ListItem>
                      {i < todayAppointments.length - 1 && <Divider />}
                    </Box>
                  )
                })}
              </List>
            )}
          </PremiumCard>
        </Grid>
      </Grid>

      {/* Overview Section */}
      {!isStaff && stats && (stats.open_incidents > 0) && (
        <PremiumCard noBorder accentColor="#DC2626" sx={{ p: 4, mt: 4 }}>
          <SectionHeader title="Overview" />
          <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <WarningIcon sx={{ color: stats.open_incidents > 0 ? '#DC2626' : '#10B981', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Active Alerts</Typography>
                <Typography variant="caption" sx={{ color: stats.open_incidents > 0 ? '#DC2626' : '#10B981', fontWeight: 700 }}>
                  {stats.open_incidents > 0 ? `${stats.open_incidents} open incident(s) requiring attention` : 'All Clear'}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </PremiumCard>
      )}
    </Box>
  )
}
