import { useEffect, useState } from 'react'
import { Grid, Typography, Box, Stack, LinearProgress, Divider, Button, List, ListItem, Chip, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import DomiciliaryDashboard from './DomiciliaryDashboard'
import {
  Group as PeopleIcon,
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
import { EmptyState } from '../../components/design/EmptyState'
import EventIcon from '@mui/icons-material/Event'
import ScheduleIcon2 from '@mui/icons-material/Schedule'
import PageContainer from '../../components/design/PageContainer'
import Skeleton from '@mui/material/Skeleton'
import { METICLE_COLORS } from '../../context/ThemeContext'

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

interface DashboardAttentionItem {
  label: string
  description: string
  value: string
  path: string
  icon: React.ReactNode
  tone: 'success' | 'warning' | 'error' | 'info'
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
  const [dashboardError, setDashboardError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
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
  const orgId = rawUser.organization_id || rawUser.organizationId
  const serviceTypes: string[] = org?.primary_service_type
    ? [org.primary_service_type]
    : (org?.service_types || [])
  const [hideOnboarding, setHideOnboarding] = useState(() => {
    try { return orgId ? localStorage.getItem(ONBOARDING_STEPS_BY_KEY + orgId) === 'true' : false } catch { return false }
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!orgId) {
        setLoading(false)
        return
      }
      setDashboardError('')
      try {
        const orgRes = await api.get(`/organizations/${orgId}`, { timeout: 15000 })
        const orgData = orgRes.data
        setOrg(orgData)
        localStorage.setItem('organization', JSON.stringify(orgData))
        if (orgData.onboarding_dismissed_at) setHideOnboarding(true)

        // Service type is authoritative before loading any dashboard widgets.
        // Supported-living endpoints are not valid for domiciliary care and
        // would otherwise surface a misleading organisation-type error.
        const effectiveTypes: string[] = orgData.primary_service_type
          ? [orgData.primary_service_type]
          : (Array.isArray(orgData.service_types) ? orgData.service_types : [])
        const isDomiciliaryOrg = effectiveTypes.some(type => ['domiciliary', 'live_in'].includes(type))
        const todayStr = new Date().toISOString().split('T')[0]
        if (isDomiciliaryOrg && !isStaff) {
          setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_people: 0, staff_on_duty: 0, open_incidents: 0, locations: 0 })
          setLoading(false)
          api.get('/dashboard/domiciliary').catch(() => {})
          return
        }
        if (isStaff) {
          const [rotaRes, aptRes] = await Promise.all([
            api.get('/dashboard/today-rota', { timeout: 15000 }),
            api.get(`/appointments?date=${todayStr}`, { timeout: 15000 }),
          ])
          setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_people: 0, staff_on_duty: 0, open_incidents: 0, locations: 0 })
          setTodayRota(rotaRes.data)
          setTodayAppointments(aptRes.data)
        } else {
          const [statsRes, complianceRes, rotaRes, widgetsRes, aptRes] = await Promise.all([
            api.get('/dashboard/stats', { timeout: 15000 }),
            api.get('/dashboard/compliance', { timeout: 15000 }),
            api.get('/dashboard/today-rota', { timeout: 15000 }),
            api.get('/dashboard/widgets', { timeout: 15000 }),
            api.get(`/appointments?date=${todayStr}`, { timeout: 15000 }),
          ])
          setStats(statsRes.data)
          setCompliance(complianceRes.data)
          setTodayRota(rotaRes.data)
          setWidgets(widgetsRes.data)
          setTodayAppointments(aptRes.data)

        }
      } catch (error: any) {
        setDashboardError(error.code === 'ECONNABORTED'
          ? 'Dashboard data is taking too long to respond.'
          : error.response?.data?.message || 'Could not load dashboard data.')
        setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_people: 0, staff_on_duty: 0, open_incidents: 0, locations: 0 })
        setCompliance([
          { label: 'Mandatory Training', val: 0, color: '#10B981' },
          { label: 'DBS Verifications', val: 0, color: '#10B981' },
          { label: 'Identity Checks', val: 0, color: '#F59E0B' },
        ])
        setTodayRota([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [orgId, retryCount])

  if (loading) {
    return (
      <PageContainer>
        <Box role="status" aria-label="Loading dashboard" sx={{ minHeight: '60vh', pt: 2 }}>
          <Skeleton variant="text" width={140} height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="min(420px, 90%)" height={42} sx={{ mb: 1 }} />
          <Skeleton variant="text" width={280} height={24} sx={{ mb: 4 }} />
          <Grid container spacing={2} sx={{ mb: 4 }}>{[0, 1, 2, 3].map((item) => <Grid item xs={12} sm={6} md={3} key={item}><Skeleton variant="rounded" height={136} /></Grid>)}</Grid>
          <Grid container spacing={2}>{[0, 1].map((item) => <Grid item xs={12} md={6} key={item}><Skeleton variant="rounded" height={260} /></Grid>)}</Grid>
        </Box>
      </PageContainer>
    )
  }

  if (dashboardError) {
    return (
      <PageContainer>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setLoading(true); setRetryCount(count => count + 1) }}>Retry</Button>}>
          {dashboardError}
        </Alert>
      </PageContainer>
    )
  }

  // If this is a domiciliary care organisation, show the dedicated dom care dashboard.
  // The child owns its data loading; do not keep the parent spinner mounted while it loads.
  if (serviceTypes.some(type => ['domiciliary', 'live_in'].includes(type)) && !isStaff) {
    return <DomiciliaryDashboard />
  }

  const statCards: Array<{ label: string; value: string; color: string; icon: React.ReactNode; path?: string }> = isStaff
    ? [
        { label: 'My Shifts Today', value: String(todayRota.length), color: 'text.primary', icon: <ScheduleIcon />, path: '/my-week' },
      ]
    : [
        { label: 'Total Staff', value: String(stats?.total_staff ?? 0), color: 'text.primary', icon: <PeopleIcon />, path: '/staff' },
        { label: 'People Supported', value: String(stats?.active_people ?? 0), color: 'text.primary', icon: <HomeIcon />, path: '/people' },
        { label: 'Staff on Duty', value: String(stats?.staff_on_duty ?? 0), color: METICLE_COLORS.success, icon: <BadgeIcon /> },
        { label: 'Compliance Rate', value: `${stats?.compliance_rate ?? 0}%`, color: METICLE_COLORS.primary, icon: <VerifiedIcon />, path: '/compliance' },
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

  const attentionItems: DashboardAttentionItem[] = [
    ...(stats && stats.open_shifts > 0 ? [{ label: 'Open shifts', description: 'Shifts still need cover', value: `${stats.open_shifts}`, path: '/shift-marketplace', icon: <ScheduleIcon />, tone: 'warning' as const }] : []),
    ...(stats && stats.open_incidents > 0 ? [{ label: 'Open incidents', description: 'Incidents are awaiting follow-up', value: `${stats.open_incidents}`, path: '/incidents', icon: <IncidentIcon />, tone: 'error' as const }] : []),
    ...(widgets ? [
      { label: 'Expiring staff documents', description: widgets.dbs_expiring_soon > 0 ? 'Staff records need renewal soon' : 'All documents are current', value: `${widgets.dbs_expiring_soon}`, path: '/compliance/identity', icon: <BadgeIcon />, tone: widgets.dbs_expiring_soon > 0 ? 'warning' as const : 'success' as const },
      { label: 'Training records', description: widgets.training_expiring_soon > 0 ? 'Training is approaching expiry' : 'Training is up to date', value: `${widgets.training_expiring_soon}`, path: '/compliance/training', icon: <SchoolIcon />, tone: widgets.training_expiring_soon > 0 ? 'warning' as const : 'success' as const },
      { label: 'Competency assessments', description: widgets.competency_due > 0 ? 'Assessments are due for review' : 'Assessments are up to date', value: `${widgets.competency_due}`, path: '/compliance/competency', icon: <CompetencyIcon />, tone: widgets.competency_due > 0 ? 'error' as const : 'success' as const },
      { label: 'Staff compliance', description: widgets.staff_below_threshold > 0 ? 'Staff below the required threshold' : 'All staff meet the threshold', value: `${widgets.staff_below_threshold}`, path: '/staff', icon: <ComplianceDownIcon />, tone: widgets.staff_below_threshold > 0 ? 'error' as const : 'success' as const },
      { label: 'Leave requests', description: widgets.pending_leave_requests > 0 ? 'Requests are waiting for review' : 'No requests awaiting review', value: `${widgets.pending_leave_requests}`, path: '/leave', icon: <LeaveIcon />, tone: widgets.pending_leave_requests > 0 ? 'info' as const : 'success' as const },
      { label: 'Critical incidents', description: widgets.open_severe_incidents > 0 ? 'Incidents need follow-up' : 'No critical incidents to review', value: `${widgets.open_severe_incidents}`, path: '/incidents', icon: <IncidentIcon />, tone: widgets.open_severe_incidents > 0 ? 'error' as const : 'success' as const },
      ...(!serviceTypes.some((type: string) => ['domiciliary', 'live_in'].includes(type)) ? [{ label: 'Medication administration', description: widgets.overdue_medications > 0 ? 'Overdue doses need attention' : 'No overdue doses', value: `${widgets.overdue_medications}`, path: '/emedication', icon: <MedIcon />, tone: widgets.overdue_medications > 0 ? 'error' as const : 'success' as const }] : []),
      ...(widgets.satisfaction_avg != null ? [{ label: 'Satisfaction', description: `${widgets.satisfaction_total} survey responses`, value: `${widgets.satisfaction_avg}/5`, path: '/compliance/satisfaction', icon: <SatisfactionIcon />, tone: widgets.satisfaction_avg >= 4 ? 'success' as const : widgets.satisfaction_avg >= 3 ? 'warning' as const : 'error' as const }] : []),
    ] : []),
  ]

  const attentionTone = {
    success: { color: METICLE_COLORS.success, bg: METICLE_COLORS.successSoft },
    warning: { color: '#9A6700', bg: METICLE_COLORS.warningSoft },
    error: { color: '#B42318', bg: METICLE_COLORS.dangerSoft },
    info: { color: METICLE_COLORS.primary, bg: METICLE_COLORS.primarySoft },
  }

  return (
    <PageContainer>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>{greeting}, {firstName}</Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          Here’s what needs your attention today.
        </Typography>
      </Box>

      {/* Onboarding Checklist */}
      {isAdmin && org && !hideOnboarding && !onboardComplete && (
        <PremiumCard sx={{ p: { xs: 2.5, sm: 3 }, mb: 4 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-start' }} spacing={1} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Welcome — let’s get you set up</Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                A few quick steps to make Meticle Care ready for your team. {onboardDone} of {onboardSteps.length} complete.
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
              bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#E6EAF0',
              '& .MuiLinearProgress-bar': { bgcolor: 'text.primary' },
            }}
          />
          <Grid container spacing={2}>
            {onboardSteps.map((step, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Box
                  sx={{
                    p: 1.5,
                    height: '100%',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'background-color 160ms ease',
                    '&:hover': { bgcolor: theme.palette.action.hover },
                    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                  }}
                  onClick={() => navigate(step.path)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(step.path) } }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: step.done ? METICLE_COLORS.successSoft : METICLE_COLORS.primarySoft,
                        color: step.done ? METICLE_COLORS.success : METICLE_COLORS.primary,
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
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{step.label}</Typography>
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

      {/* At-a-glance metrics */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statCards.map((stat, i) => (
          <Grid item xs={isStaff ? 12 : 6} sm={isStaff ? 12 : 6} md={isStaff ? 12 : 3} key={i}>
            <StatCard
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              onClick={stat.path ? () => navigate(stat.path!) : undefined}
            />
          </Grid>
        ))}
      </Grid>

      {/* Priority items: one compact list replaces the scattered compliance widgets */}
      {!isStaff && (
        <PremiumCard sx={{ p: { xs: 2.5, sm: 3 }, mb: 4 }}>
          <SectionHeader title="Needs attention" subtitle="Priority items and upcoming reviews" />
          {attentionItems.filter((item) => item.tone !== 'success').length === 0 ? (
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5, color: 'success.dark' }}>
              <VerifiedIcon sx={{ fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Everything is up to date. No priority actions right now.</Typography>
            </Stack>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {attentionItems.filter((item) => item.tone !== 'success').map((item) => {
                const tone = attentionTone[item.tone]
                return (
                  <Box key={item.label} component="button" type="button" onClick={() => navigate(item.path)} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5, py: 1.5, textAlign: 'left', color: 'inherit', bgcolor: 'transparent', border: 0, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } }}>
                    <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: tone.bg, color: tone.color, flexShrink: 0 }}>{item.icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                    </Box>
                    <Chip label={item.value} size="small" sx={{ bgcolor: tone.bg, color: tone.color, minWidth: 38 }} />
                  </Box>
                )
              })}
            </Stack>
          )}
        </PremiumCard>
      )}

      <Grid container spacing={2}>
        {/* Compliance Snapshot */}
        {!isStaff && (
          <Grid item xs={12} md={4}>
            <PremiumCard sx={{ p: { xs: 2.5, sm: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <SectionHeader
                title="Compliance Snapshot"
                subtitle="Overall readiness for inspection"
              />
              <Box sx={{ flexGrow: 1 }}>
                {compliance.length === 0 ? (
                  <EmptyState
                    title="No compliance data"
                    description="Start by uploading staff documents to track compliance."
                    action={{ label: 'View Compliance', onClick: () => navigate('/compliance') }}
                  />
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
                            bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F5F7FA',
                            '& .MuiLinearProgress-bar': { bgcolor: item.val > 0 ? item.color : '#E6EAF0', borderRadius: 4 },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ textAlign: 'center' }}>
                <Button size="small" endIcon={<ArrowIcon fontSize="small" />} sx={{ color: 'text.primary', fontWeight: 700 }} onClick={() => navigate('/compliance')}>
                  View Full Report
                </Button>
              </Box>
            </PremiumCard>
          </Grid>
        )}

        {/* Today's Rota */}
        <Grid item xs={12} md={isStaff ? 12 : 4}>
          <PremiumCard sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: { xs: 2.5, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Today's Rota</Typography>
              <Chip
                label={todayRota.length > 0 ? 'Active Now' : 'No Shifts'}
                size="small"
                sx={{
                  bgcolor: todayRota.length > 0 ? METICLE_COLORS.primarySoft : theme.palette.action.hover,
                  color: todayRota.length > 0 ? METICLE_COLORS.primary : theme.palette.text.secondary,
                  fontWeight: 700,
                  borderRadius: '10px',
                }}
              />
            </Box>
            <Divider />
            {todayRota.length === 0 ? (
              <EmptyState
                icon={<ScheduleIcon2 />}
                title="No shifts today"
                description="You have no shifts scheduled for today. Check your schedule to see upcoming shifts."
              />
            ) : (
              <List sx={{ pt: 0 }}>
                {todayRota.map((shift, i) => {
                  const timeStr = `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  const statusColor = shift.status === 'filled' ? METICLE_COLORS.success : shift.status === 'open' ? METICLE_COLORS.danger : theme.palette.text.secondary
                  const statusBg = shift.status === 'filled' ? METICLE_COLORS.successSoft : shift.status === 'open' ? METICLE_COLORS.dangerSoft : theme.palette.action.hover

                  return (
                    <Box key={shift.id}>
                      <ListItem sx={{ py: 2, px: { xs: 2.5, sm: 3 } }}>
                        <Stack spacing={1.5} sx={{ width: '100%' }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{shift.location_name}</Typography>
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
          <PremiumCard sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: { xs: 2.5, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Today's Appointments</Typography>
              <Chip
                label={todayAppointments.length > 0 ? `${todayAppointments.length} Total` : 'None'}
                size="small"
                sx={{
                  bgcolor: todayAppointments.length > 0 ? METICLE_COLORS.successSoft : theme.palette.action.hover,
                  color: todayAppointments.length > 0 ? METICLE_COLORS.success : theme.palette.text.secondary,
                  fontWeight: 700,
                  borderRadius: '10px',
                }}
              />
            </Box>
            <Divider />
            {todayAppointments.length === 0 ? (
              <EmptyState
                icon={<EventIcon />}
                title="No appointments today"
                description="You have no appointments scheduled for today."
                action={{ label: 'Book Appointment', onClick: () => navigate('/appointments') }}
              />
            ) : (
              <List sx={{ pt: 0 }}>
                {todayAppointments.map((apt, i) => {
                  const timeStr = `${new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  const statusColor = apt.status === 'completed' ? METICLE_COLORS.success : apt.status === 'cancelled' ? METICLE_COLORS.danger : theme.palette.text.secondary
                  const statusBg = apt.status === 'completed' ? METICLE_COLORS.successSoft : apt.status === 'cancelled' ? METICLE_COLORS.dangerSoft : theme.palette.action.hover
                  return (
                    <Box key={apt.id}>
                      <ListItem sx={{ py: 2, px: { xs: 2.5, sm: 3 } }}>
                        <Stack spacing={1.5} sx={{ width: '100%' }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{apt.title}</Typography>
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
                                  bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F5F7FA',
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
        <Box sx={{ mt: 'var(--section-gap)', display: 'flex', alignItems: 'center', gap: 1.5, color: METICLE_COLORS.danger }}>
          <WarningIcon sx={{ fontSize: 20 }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {stats.open_incidents} open incident{stats.open_incidents === 1 ? '' : 's'} requiring attention
          </Typography>
          <Button size="small" onClick={() => navigate('/incidents')} sx={{ ml: 0.5 }}>Review incidents</Button>
        </Box>
      )}
    </PageContainer>
  )
}
