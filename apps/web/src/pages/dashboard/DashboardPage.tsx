import { useEffect, useState } from 'react'
import { Grid, Paper, Typography, Box, Stack, LinearProgress, Divider, Button, List, ListItem, CircularProgress, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
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
  FlagOutlined as FlagIcon,
  LocationOn as LocationIcon,
  Medication as MedIcon,
  Checklist as CompetencyIcon,
  Star as SatisfactionIcon,
  ReportProblem as IncidentIcon,
  TrendingDown as ComplianceDownIcon,
} from '@mui/icons-material'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'

interface DashboardStats {
  total_staff: number
  compliance_rate: number
  open_shifts: number
  agency_saved: number
  active_service_users: number
  staff_on_duty: number
  open_incidents: number
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
  service_user_name: string
}

const ONBOARDING_STEPS = [
  { label: 'Add your location', desc: 'Create your first location so your data stays organised by site.', icon: <LocationIcon />, path: '/settings' },
  { label: 'Add your staff', desc: 'Invite team members. They\'ll receive an email with a link to set their password.', icon: <PeopleIcon />, path: '/staff' },
  { label: 'Add people', desc: 'Add the people in your care once your location is set up.', icon: <HomeIcon />, path: '/service-users' },
  { label: 'Explore your dashboard', desc: 'See live overviews of tasks, alerts, appointments, and compliance.', icon: <FlagIcon />, path: '/compliance' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [widgets, setWidgets] = useState<DashboardWidgets | null>(null)
  const [compliance, setCompliance] = useState<ComplianceItem[]>([])
  const [todayRota, setTodayRota] = useState<RotaItem[]>([])
  const [hideOnboarding, setHideOnboarding] = useState(false)
  const [todayAppointments, setTodayAppointments] = useState<AppointmentItem[]>([])
  const userStr = localStorage.getItem('user')
  let rawUser: any = {}
  try { rawUser = userStr ? JSON.parse(userStr) : {} } catch { rawUser = {} }
  const firstName = rawUser.first_name || rawUser.email?.split('@')[0] || 'Sarah'
  const isStaff = rawUser.role === UserRole.CARE_WORKER
  const isAdmin = rawUser.role === UserRole.ORG_ADMIN

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'

  const [org, setOrg] = useState<any>(null)
  const orgId = rawUser.organization_id || rawUser.organizationId

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

        const todayStr = new Date().toISOString().split('T')[0]
        if (isStaff) {
          const [rotaRes, aptRes] = await Promise.all([
            api.get('/dashboard/today-rota'),
            api.get(`/appointments?date=${todayStr}`),
          ])
          setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_service_users: 0, staff_on_duty: 0, open_incidents: 0 })
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
        }
      } catch {
        setStats({ total_staff: 0, compliance_rate: 0, open_shifts: 0, agency_saved: 0, active_service_users: 0, staff_on_duty: 0, open_incidents: 0 })
        setCompliance([
          { label: 'Mandatory Training', val: 0, color: '#16A34A' },
          { label: 'DBS Verifications', val: 0, color: '#16A34A' },
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

  const statCards = isStaff
    ? [
        { label: 'My Shifts Today', value: String(todayRota.length), color: '#0F4C81', icon: <ScheduleIcon /> },
      ]
    : [
        { label: 'Total Staff', value: String(stats?.total_staff ?? 0), color: '#0F4C81', icon: <PeopleIcon />, path: '/staff' },
        { label: 'Active People', value: String(stats?.active_service_users ?? 0), color: '#0F4C81', icon: <HomeIcon />, path: '/service-users' },
        { label: 'Staff on Duty', value: String(stats?.staff_on_duty ?? 0), color: '#16A34A', icon: <BadgeIcon /> },
        { label: 'Compliance Rate', value: `${stats?.compliance_rate ?? 0}%`, color: '#16A34A', icon: <VerifiedIcon />, path: '/compliance' },
        { label: 'Open Shifts', value: String(stats?.open_shifts ?? 0), color: '#D97706', icon: <AlertIcon />, path: '/shift-marketplace' },
        { label: 'Alerts', value: String(stats?.open_incidents ?? 0), color: (stats?.open_incidents ?? 0) > 0 ? '#DC2626' : '#16A34A', icon: <WarningIcon />, path: '/incidents' },
        { label: 'Agency Saved', value: `£${stats?.agency_saved ?? 0}`, color: '#0F4C81', icon: <TrendingUpIcon /> },
      ]

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>{greeting}, {firstName}</Typography>
        <Typography color="#6B7280">
          Here's your overview for today.
        </Typography>
      </Box>

      {/* Onboarding Checklist */}
      {isAdmin && org && !org.onboarding_completed && !hideOnboarding && (
        <Paper elevation={0} sx={{ mb: 4, p: 3, border: '1px solid #E5E7EB', borderRadius: 3, bgcolor: '#F8FAFC' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Set up your account</Typography>
            <Button size="small" sx={{ color: '#6B7280', fontWeight: 600 }} onClick={() => setHideOnboarding(true)}>I'm all set, hide this</Button>
          </Stack>
          <Typography variant="body2" color="#6B7280" sx={{ mb: 3 }}>Follow these steps to get Meticle ready for your team.</Typography>
          <Grid container spacing={2}>
            {ONBOARDING_STEPS.map((step, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Box
                  sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB', cursor: 'pointer', '&:hover': { borderColor: '#0F4C81' } }}
                  onClick={() => navigate(step.path)}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 32, height: 32, bgcolor: '#0F4C8110', color: '#0F4C81', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                      {i + 1}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{step.label}</Typography>
                      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.3 }}>{step.desc}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((stat, i) => (
          <Grid item xs={12} sm={6} md={3} lg={statCards.length > 4 ? 1.7 : 3} key={i}>
            <Paper className="enterprise-card" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', cursor: stat.path ? 'pointer' : 'default', transition: 'box-shadow 0.2s', '&:hover': stat.path ? { boxShadow: '0 8px 20px rgba(0,0,0,0.1)' } : {} }}
              onClick={stat.path ? () => navigate(stat.path) : undefined}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                <Box sx={{ width: 40, height: 40, bgcolor: `${stat.color}10`, color: stat.color, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {stat.icon}
                </Box>
              </Stack>
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{stat.value}</Typography>
              <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>{stat.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Widgets Row */}
      {!isStaff && widgets && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {[
            { label: 'Staff with Expiring Docs', value: widgets.dbs_expiring_soon, icon: <BadgeIcon />, color: widgets.dbs_expiring_soon > 0 ? '#D97706' : '#16A34A', path: '/compliance/identity', emptyMsg: 'All documents valid', warnMsg: `${widgets.dbs_expiring_soon} staff expiring soon` },
            { label: 'Training Expiring', value: widgets.training_expiring_soon, icon: <SchoolIcon />, color: widgets.training_expiring_soon > 0 ? '#D97706' : '#16A34A', path: '/compliance/training', emptyMsg: 'All training current', warnMsg: `${widgets.training_expiring_soon} records expiring` },
            { label: 'Competency Due', value: widgets.competency_due, icon: <CompetencyIcon />, color: widgets.competency_due > 0 ? '#DC2626' : '#16A34A', path: '/compliance/competency', emptyMsg: 'All assessed', warnMsg: `${widgets.competency_due} assessments due` },
            { label: 'Staff Below Threshold', value: widgets.staff_below_threshold, icon: <ComplianceDownIcon />, color: widgets.staff_below_threshold > 0 ? '#DC2626' : '#16A34A', path: '/staff', emptyMsg: 'All staff compliant', warnMsg: `${widgets.staff_below_threshold} staff need attention` },
            { label: 'Pending Leave', value: widgets.pending_leave_requests, icon: <LeaveIcon />, color: widgets.pending_leave_requests > 0 ? '#0F4C81' : '#16A34A', path: '/leave', emptyMsg: 'No pending requests', warnMsg: `${widgets.pending_leave_requests} pending approvals` },
            { label: 'Open Critical Incidents', value: widgets.open_severe_incidents, icon: <IncidentIcon />, color: widgets.open_severe_incidents > 0 ? '#DC2626' : '#16A34A', path: '/incidents', emptyMsg: 'No critical incidents', warnMsg: `${widgets.open_severe_incidents} need attention` },
            { label: 'Overdue Medications', value: widgets.overdue_medications, icon: <MedIcon />, color: widgets.overdue_medications > 0 ? '#DC2626' : '#16A34A', path: '/emedication', emptyMsg: 'All administered', warnMsg: `${widgets.overdue_medications} doses overdue` },
            widgets.satisfaction_avg != null ? { label: `Satisfaction Rating`, value: widgets.satisfaction_avg, icon: <SatisfactionIcon />, color: (widgets.satisfaction_avg || 0) >= 4 ? '#16A34A' : (widgets.satisfaction_avg || 0) >= 3 ? '#D97706' : '#DC2626', path: '/compliance/satisfaction', emptyMsg: 'No surveys yet', warnMsg: `${widgets.satisfaction_total} responses`, format: (v: number) => `${v}/5` } : null,
          ].filter(Boolean).map((w: any, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Paper
                elevation={0}
                sx={{ p: 2.5, border: '1px solid #E5E7EB', borderRadius: 2.5, cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { borderColor: w.color } }}
                onClick={(e) => { e.stopPropagation(); navigate(w.path) }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ color: w.color }}>{w.icon}</Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{w.label}</Typography>
                  </Stack>
                  <Chip label={(w.format ? w.format(w.value) : w.value > 0 ? w.value : '0') as any} size="small" onClick={(e) => { e.stopPropagation(); navigate(w.path) }} sx={{ bgcolor: w.value > 0 ? `${w.color}15` : '#16A34A10', color: w.value > 0 ? w.color : '#16A34A', fontWeight: 700, fontSize: '0.65rem', cursor: 'pointer' }} />
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" sx={{ color: w.value > 0 ? w.color : '#9CA3AF', display: 'block' }}>
                  {w.value > 0 ? w.warnMsg : w.emptyMsg}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Compliance at a Glance */}
      {!isStaff && widgets?.compliance_breakdown && (
        <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #E5E7EB', borderRadius: 2.5, borderLeft: '4px solid #0F4C81' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F4C81' }}>Compliance at a Glance</Typography>
            <Button size="small" endIcon={<ArrowIcon fontSize="small" />} onClick={() => navigate('/compliance')} sx={{ color: '#0F4C81', fontWeight: 700, textTransform: 'none' }}>
              View Compliance Dashboard
            </Button>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81' }}>{widgets.compliance_breakdown.compliant_count}</Typography>
                <Typography variant="caption" color="#6B7280">Staff Compliant</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: widgets.compliance_breakdown.below_threshold > 0 ? '#DC2626' : '#16A34A' }}>{widgets.compliance_breakdown.below_threshold}</Typography>
                <Typography variant="caption" color="#6B7280">Below Threshold</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: widgets.competency_due > 0 ? '#D97706' : '#16A34A' }}>{widgets.competency_due}</Typography>
                <Typography variant="caption" color="#6B7280">Competency Due</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: widgets.open_severe_incidents > 0 ? '#DC2626' : '#16A34A' }}>{widgets.open_severe_incidents}</Typography>
                <Typography variant="caption" color="#6B7280">Open Severe Incidents</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Grid container spacing={4}>
        {!isStaff && (
          <Grid item xs={12} md={4}>
            <Paper className="enterprise-card" sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Compliance Snapshot</Typography>
                <Typography variant="body2" color="#6B7280">Overall readiness for inspection.</Typography>
              </Box>
              <Divider />
              <Box sx={{ p: 4 }}>
                {compliance.length === 0 ? (
                  <Typography variant="body2" color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>
                    No compliance data yet. Start by uploading staff documents.
                  </Typography>
                ) : (
                  <Stack spacing={4}>
                    {compliance.map((item) => (
                      <Box key={item.label}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: item.val > 0 ? item.color : '#9CA3AF' }}>{item.val}%</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={item.val}
                          sx={{ height: 8, borderRadius: 4, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: item.val > 0 ? item.color : '#E5E7EB' } }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
              <Divider />
              <Box sx={{ p: 2, textAlign: 'center' }}>
                 <Button size="small" endIcon={<ArrowIcon fontSize="small" />} sx={{ color: '#0F4C81', fontWeight: 700 }} onClick={() => navigate('/compliance')}>View Full Report</Button>
              </Box>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12} md={isStaff ? 12 : 4}>
          <Paper className="enterprise-card" sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Today's Rota</Typography>
              <Box sx={{ bgcolor: '#0F4C8110', color: '#0F4C81', px: 1.5, py: 0.5, borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 700 }}>
                {todayRota.length > 0 ? 'Active Now' : 'No Shifts'}
              </Box>
            </Box>
            <Divider />
            {todayRota.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="#9CA3AF">No shifts scheduled for today.</Typography>
                <Button size="small" sx={{ mt: 2, color: '#0F4C81', fontWeight: 700 }}>Create Shift</Button>
              </Box>
            ) : (
              <List sx={{ pt: 0 }}>
                {todayRota.map((shift, i) => {
                  const timeStr = `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  const statusColor = shift.status === 'filled' ? '#16A34A' : shift.status === 'open' ? '#DC2626' : '#6B7280'
                  const statusBg = shift.status === 'filled' ? '#16A34A10' : shift.status === 'open' ? '#DC262610' : '#F1F5F9'

                  return (
                    <Box key={shift.id}>
                      <ListItem sx={{ py: 3, px: 4 }}>
                        <Stack spacing={2} sx={{ width: '100%' }}>
                          <Stack direction="row" justifyContent="space-between">
                             <Typography variant="body2" sx={{ fontWeight: 800 }}>{shift.location_name}</Typography>
                             <Typography variant="caption" sx={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                               <ClockIcon sx={{ fontSize: 14 }} /> {timeStr}
                             </Typography>
                          </Stack>
                          {shift.assigned_staff && (
                            <Typography variant="body2" sx={{ color: '#6B7280' }}>{shift.assigned_staff}</Typography>
                          )}
                          <Stack direction="row" spacing={1}>
                             <Box sx={{ bgcolor: statusBg, color: statusColor, px: 1.5, py: 0.5, borderRadius: 1, fontSize: '0.7rem', fontWeight: 800, textTransform: 'capitalize' }}>
                               {shift.status}
                             </Box>
                          </Stack>
                        </Stack>
                      </ListItem>
                      {i < todayRota.length - 1 && <Divider />}
                    </Box>
                  )
                })}
              </List>
            )}
            {todayRota.length > 0 && (
              <>
                <Divider />
                <Box sx={{ p: 2, textAlign: 'center' }}>
                   <Button size="small" sx={{ color: '#0F4C81', fontWeight: 700 }}>Open Planner</Button>
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={isStaff ? 12 : 4}>
          <Paper className="enterprise-card" sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Today's Appointments</Typography>
              <Box sx={{ bgcolor: '#16A34A10', color: '#16A34A', px: 1.5, py: 0.5, borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 700 }}>
                {todayAppointments.length > 0 ? `${todayAppointments.length} Total` : 'None'}
              </Box>
            </Box>
            <Divider />
            {todayAppointments.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="#9CA3AF">No appointments scheduled for today.</Typography>
                <Button size="small" sx={{ mt: 2, color: '#0F4C81', fontWeight: 700 }} onClick={() => navigate('/appointments')}>Book Appointment</Button>
              </Box>
            ) : (
              <List sx={{ pt: 0 }}>
                {todayAppointments.map((apt, i) => {
                  const timeStr = `${new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  const statusColor = apt.status === 'completed' ? '#16A34A' : apt.status === 'cancelled' ? '#DC2626' : '#0F4C81'
                  const statusBg = apt.status === 'completed' ? '#16A34A10' : apt.status === 'cancelled' ? '#DC262610' : '#0F4C8110'
                  return (
                    <Box key={apt.id}>
                      <ListItem sx={{ py: 3, px: 4 }}>
                        <Stack spacing={2} sx={{ width: '100%' }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{apt.title}</Typography>
                            <Typography variant="caption" sx={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ClockIcon sx={{ fontSize: 14 }} /> {timeStr}
                            </Typography>
                          </Stack>
                          {(apt.service_user_name || apt.staff_name) && (
                            <Typography variant="body2" sx={{ color: '#6B7280' }}>
                              {apt.service_user_name}{apt.service_user_name && apt.staff_name ? ' • ' : ''}{apt.staff_name}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1}>
                            <Box sx={{ bgcolor: statusBg, color: statusColor, px: 1.5, py: 0.5, borderRadius: 1, fontSize: '0.7rem', fontWeight: 800, textTransform: 'capitalize' }}>
                              {apt.status}
                            </Box>
                            {apt.location_name && (
                              <Box sx={{ bgcolor: '#F1F5F9', color: '#6B7280', px: 1.5, py: 0.5, borderRadius: 1, fontSize: '0.7rem', fontWeight: 800 }}>
                                {apt.location_name}
                              </Box>
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
            {todayAppointments.length > 0 && (
              <>
                <Divider />
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Button size="small" sx={{ color: '#0F4C81', fontWeight: 700 }} onClick={() => navigate('/appointments')}>View Appointments</Button>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Overview Section */}
      {!isStaff && stats && (stats.open_incidents > 0) && (
        <Box sx={{ mt: 4 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Overview</Typography>
            <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <WarningIcon sx={{ color: stats.open_incidents > 0 ? '#DC2626' : '#16A34A', fontSize: 20 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Active Alerts</Typography>
                  <Typography variant="caption" sx={{ color: stats.open_incidents > 0 ? '#DC2626' : '#16A34A', fontWeight: 700 }}>
                    {stats.open_incidents > 0 ? `${stats.open_incidents} open incident(s) requiring attention` : 'All Clear'}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      )}
    </Box>
  )
}
