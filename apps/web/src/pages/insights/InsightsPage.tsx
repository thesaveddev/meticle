import { useState, useEffect } from 'react'
import {
  Box, Grid, Paper, Typography, Stack, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  LinearProgress, Divider,
} from '@mui/material'
import {
  People as PeopleIcon, CheckCircle as CheckIcon, EventBusy as LeaveIcon,
  Schedule as ShiftIcon, TrendingUp as TrendIcon, Psychology as OutcomeIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material'
import api from '../../services/api'

interface Overview {
  total_staff: number; compliance_rate: number; open_shifts: number;
  staff_on_leave: number; pending_leave: number; overtime_hours_month: number;
}

interface StaffingRole { role: string; count: number }
interface StaffingLocation { id: string; name: string; staff_count: number }


interface ComplianceOverall { total_records: number; completed: number; rate: number }
interface ComplianceCategory { category: string; total: number; completed: number }
interface Expiring { next_30: number; next_60: number; next_90: number }

interface LeaveType { id: string; name: string; color: string; total_hours: number; total_requests: number; approved: number; rejected: number; pending: number }
interface LeaveTrend { month: string; hours: number; requests: number }
interface OnLeaveStaff { first_name: string; last_name: string; leave_type: string; end_date: string }

interface ShiftStatus { status: string; count: number }
interface LocationFill { name: string; total_shifts: number; filled: number }
interface UpcomingShift { id: string; start_time: string; end_time: string; location: string; assigned_staff: number; minimum_staff_per_day: number }

interface OutcomeGoalsByDomain { cqc_domain: string; total: number; completed: number; avg_progress: number }
interface OutcomeWellbeing { domain: string; avg_score: number; entries: number; min_score: number; max_score: number }
interface OutcomeScaleBand { band_label: string; count: number }
interface OutcomeGoalProgressTrend { week: string; avg_progress: number; updates: number }
interface OutcomesData {
  goal_completion_by_domain: OutcomeGoalsByDomain[]
  wellbeing_by_domain: OutcomeWellbeing[]
  scale_distribution: OutcomeScaleBand[]
  overdue_reviews: number
  goal_progress_trend: OutcomeGoalProgressTrend[]
}

const statusColors: Record<string, string> = {
  open: '#D97706', filled: '#16A34A', completed: '#0F4C81', cancelled: '#DC2626', pending: '#D97706',
}

const roleLabels: Record<string, string> = {
  ORG_ADMIN: 'Admin', MANAGER: 'Manager', CARE_WORKER: 'Care Worker', COMPLIANCE_OFFICER: 'Compliance',
}

export default function InsightsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [staffingByRole, setStaffingByRole] = useState<StaffingRole[]>([])
  const [staffingByLocation, setStaffingByLocation] = useState<StaffingLocation[]>([])

  const [complianceOverall, setComplianceOverall] = useState<ComplianceOverall | null>(null)
  const [complianceByCategory, setComplianceByCategory] = useState<ComplianceCategory[]>([])
  const [expiring, setExpiring] = useState<Expiring | null>(null)
  const [staffBelowThreshold, setStaffBelowThreshold] = useState(0)
  const [complianceThreshold, setComplianceThreshold] = useState(100)
  const [leaveByType, setLeaveByType] = useState<LeaveType[]>([])
  const [leaveTrend, setLeaveTrend] = useState<LeaveTrend[]>([])
  const [onLeaveStaff, setOnLeaveStaff] = useState<OnLeaveStaff[]>([])
  const [shiftStatuses, setShiftStatuses] = useState<ShiftStatus[]>([])
  const [fillRate, setFillRate] = useState<LocationFill[]>([])
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShift[]>([])
  const [outcomes, setOutcomes] = useState<OutcomesData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setError('')
      try {
        const [ov, st, co, lv, ro, oc] = await Promise.all([
          api.get('/insights/overview'),
          api.get('/insights/staffing'),
          api.get('/insights/compliance'),
          api.get('/insights/leave'),
          api.get('/insights/rota'),
          api.get('/insights/outcomes'),
        ])
        setOverview(ov.data)
        setStaffingByRole(st.data.byRole)
        setStaffingByLocation(st.data.byLocation)
        setComplianceOverall(co.data.overall)
        setComplianceByCategory(co.data.byCategory)
        setExpiring(co.data.expiring)
        setStaffBelowThreshold(co.data.staffBelowThreshold)
        setComplianceThreshold(co.data.threshold)
        setLeaveByType(lv.data.byType)
        setLeaveTrend(lv.data.monthlyTrend)
        setOnLeaveStaff(lv.data.currentlyOnLeave)
        setShiftStatuses(ro.data.byStatus)
        setFillRate(ro.data.fillRateByLocation)
        setUpcomingShifts(ro.data.upcoming)
        setOutcomes(oc.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load insights')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (error) return <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Insights</Typography>

      {/* Overview Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'Total Staff', value: overview?.total_staff ?? 0, icon: <PeopleIcon />, color: '#0F4C81' },
          { label: 'Compliance Rate', value: `${overview?.compliance_rate ?? 0}%`, icon: <CheckIcon />, color: '#16A34A' },
          { label: 'Open Shifts', value: overview?.open_shifts ?? 0, icon: <ShiftIcon />, color: '#D97706' },
          { label: 'Staff on Leave', value: overview?.staff_on_leave ?? 0, icon: <LeaveIcon />, color: '#DC2626' },
          { label: 'Pending Leave', value: overview?.pending_leave ?? 0, icon: <LeaveIcon />, color: '#9333EA' },
          { label: 'Overtime (Month)', value: `${overview?.overtime_hours_month ?? 0}h`, icon: <TrendIcon />, color: '#0F4C81' },
        ].map((item, i) => (
          <Grid item xs={6} md={4} lg={2} key={i}>
            <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: item.color }}>{item.icon}</Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{item.value}</Typography>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Staffing */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Staff by Role</Typography>
            {staffingByRole.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No staff data</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staffingByRole.map((r) => (
                      <TableRow key={r.role}>
                        <TableCell>{roleLabels[r.role] || r.role}</TableCell>
                        <TableCell align="right"><Chip label={r.count} size="small" sx={{ fontWeight: 700 }} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Staff by Location</Typography>
            {staffingByLocation.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No locations</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Staff</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staffingByLocation.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell align="right"><Chip label={l.staff_count} size="small" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* Compliance */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Compliance</Typography>
            <Stack spacing={2}>
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>Overall Rate</Typography>
                  <Typography variant="body2" fontWeight={700} color={(complianceOverall?.rate ?? 0) >= complianceThreshold ? '#16A34A' : '#DC2626'}>
                    {complianceOverall?.rate ?? 0}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={complianceOverall?.rate ?? 0}
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: (complianceOverall?.rate ?? 0) >= complianceThreshold ? '#16A34A' : '#DC2626' } }}
                />
              </Box>
              <Typography variant="caption" color="#6B7280">
                {complianceOverall?.completed ?? 0} / {complianceOverall?.total_records ?? 0} records complete
                &nbsp;| {staffBelowThreshold > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>{staffBelowThreshold} staff below {complianceThreshold}% threshold</span>}
              </Typography>
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>By Category</Typography>
            {complianceByCategory.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No compliance data</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {complianceByCategory.map((c) => (
                      <TableRow key={c.category}>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{c.category.replace(/_/g, ' ')}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                            <Typography variant="body2" fontWeight={700}>
                              {c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={c.total > 0 ? (c.completed / c.total) * 100 : 0}
                              sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: '#0F4C81' } }}
                            />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Expiring Documents</Typography>
            {expiring ? (
              <Stack direction="row" spacing={2}>
                {[
                  { label: '30 days', value: expiring.next_30, color: expiring.next_30 > 0 ? '#DC2626' : '#16A34A' },
                  { label: '60 days', value: expiring.next_60, color: expiring.next_60 > 0 ? '#D97706' : '#16A34A' },
                  { label: '90 days', value: expiring.next_90, color: '#0F4C81' },
                ].map((e) => (
                  <Chip key={e.label} label={`${e.value} in ${e.label}`} size="small" sx={{ fontWeight: 600, bgcolor: `${e.color}15`, color: e.color }} />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="#9CA3AF">No data</Typography>
            )}
          </Paper>
        </Grid>

        {/* Leave */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Leave by Type (This Year)</Typography>
            {leaveByType.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No leave data</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Hours</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Approved</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Pending</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveByType.map((lt) => (
                      <TableRow key={lt.id}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: lt.color }} />
                            <Typography variant="body2">{lt.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{lt.total_hours}h</TableCell>
                        <TableCell align="right">
                          <Chip label={lt.approved} size="small" sx={{ bgcolor: '#16A34A15', color: '#16A34A', fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="right">
                          {lt.pending > 0 && <Chip label={lt.pending} size="small" sx={{ bgcolor: '#D9770615', color: '#D97706', fontWeight: 700 }} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Currently on Leave</Typography>
            {onLeaveStaff.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No staff on leave today</Typography>
            ) : (
              <Stack spacing={1}>
                {onLeaveStaff.map((s, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{s.first_name} {s.last_name}</Typography>
                        <Typography variant="caption" color="#6B7280">{s.leave_type}</Typography>
                      </Box>
                      <Chip label={`until ${s.end_date}`} size="small" variant="outlined" />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Monthly Trend</Typography>
            {leaveTrend.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No trend data</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Hours</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Requests</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveTrend.slice(-6).map((m) => (
                      <TableRow key={m.month}>
                        <TableCell>{m.month}</TableCell>
                        <TableCell align="right">{m.hours}h</TableCell>
                        <TableCell align="right">{m.requests}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* Rota */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Shift Status (Last 30 Days)</Typography>
            {shiftStatuses.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No shift data</Typography>
            ) : (
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                {shiftStatuses.map((s) => (
                  <Chip
                    key={s.status}
                    label={`${s.status}: ${s.count}`}
                    size="small"
                    sx={{ fontWeight: 700, bgcolor: `${statusColors[s.status] || '#6B7280'}15`, color: statusColors[s.status] || '#6B7280', textTransform: 'capitalize' }}
                  />
                ))}
              </Stack>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Fill Rate by Location</Typography>
            {fillRate.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No data</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Filled / Total</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fillRate.map((l) => {
                      const pct = l.total_shifts > 0 ? Math.round((l.filled / l.total_shifts) * 100) : 0
                      return (
                        <TableRow key={l.name}>
                          <TableCell>{l.name}</TableCell>
                          <TableCell align="right">{l.filled} / {l.total_shifts}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={700} color={pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626'}>
                              {pct}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Upcoming Shifts (Next 7 Days)</Typography>
            {upcomingShifts.length === 0 ? (
              <Typography variant="body2" color="#9CA3AF">No upcoming shifts</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Staffed</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Min Req</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingShifts.map((s) => {
                      const date = new Date(s.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                      const understaffed = s.assigned_staff < s.minimum_staff_per_day
                      return (
                        <TableRow key={s.id} sx={{ bgcolor: understaffed ? '#DC262605' : 'inherit' }}>
                          <TableCell>{s.location}</TableCell>
                          <TableCell>{date}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={700} color={understaffed ? '#DC2626' : '#16A34A'}>
                              {s.assigned_staff}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="#6B7280">{s.minimum_staff_per_day}</Typography>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* Outcomes */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <OutcomeIcon sx={{ color: '#7C3AED' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Outcomes</Typography>
            </Stack>
            {outcomes ? (
              <>
                {outcomes.goal_completion_by_domain.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Goal Completion by CQC Domain</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead><TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Completed</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Avg Progress</TableCell>
                        </TableRow></TableHead>
                        <TableBody>
                          {outcomes.goal_completion_by_domain.map(d => (
                            <TableRow key={d.cqc_domain}>
                              <TableCell><Chip label={d.cqc_domain} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} /></TableCell>
                              <TableCell align="right"><Chip label={d.completed} size="small" sx={{ bgcolor: '#DCFCE7', color: '#16A34A', fontWeight: 700 }} /></TableCell>
                              <TableCell align="right">{d.total}</TableCell>
                              <TableCell align="right">
                                <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                                  <LinearProgress variant="determinate" value={d.avg_progress || 0} sx={{ width: 60, height: 5, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: d.avg_progress >= 60 ? '#16A34A' : '#D97706' } }} />
                                  <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 30 }}>{d.avg_progress || 0}%</Typography>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Divider sx={{ my: 2 }} />
                  </>
                )}
                {outcomes.overdue_reviews > 0 && (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, p: 1.5, bgcolor: '#FFF7ED', borderRadius: 1.5 }}>
                    <WarningAmberIcon sx={{ color: '#DC2626', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#DC2626' }}>{outcomes.overdue_reviews} overdue goal reviews</Typography>
                  </Stack>
                )}
                {outcomes.wellbeing_by_domain.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Wellbeing Averages (30d)</Typography>
                    <Stack spacing={1}>
                      {outcomes.wellbeing_by_domain.map(w => (
                        <Stack key={w.domain} direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" sx={{ minWidth: 80, textTransform: 'capitalize', fontSize: '0.8rem' }}>{w.domain}</Typography>
                          <LinearProgress variant="determinate" value={(w.avg_score || 0) * 10} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: (w.avg_score || 0) >= 8 ? '#16A34A' : (w.avg_score || 0) >= 5 ? '#D97706' : '#DC2626' } }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 35 }}>{w.avg_score}/10</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                  </>
                )}
                {outcomes.scale_distribution.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Scale Assessment Bands</Typography>
                    <Stack direction="row" spacing={1}>
                      {outcomes.scale_distribution.map(b => (
                        <Chip key={b.band_label} label={`${b.band_label}: ${b.count}`} size="small" sx={{ fontWeight: 700, bgcolor: '#EEF2FF', color: '#3730A3' }} />
                      ))}
                    </Stack>
                  </>
                )}
              </>
            ) : (
              <Typography variant="body2" color="#9CA3AF">No outcomes data</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
