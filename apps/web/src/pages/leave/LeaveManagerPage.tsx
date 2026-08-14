import { useState, useEffect, useCallback } from 'react'
import {
  Box, Paper, Typography, Button, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Stack, IconButton,
  Alert, FormControl, InputLabel, Select, Tooltip, Switch, FormControlLabel,
  Popover, List, ListItem, ListItemText, Divider, CircularProgress, TablePagination,
} from '@mui/material'
import {
  Add as AddIcon, CheckCircle as ApproveIcon,
  Cancel as RejectIcon, CalendarMonth as CalendarIcon, BeachAccess as LeaveIcon,
  Info as InfoIcon, ChevronLeft, ChevronRight, Delete as DeleteIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { ConfirmDialog } from '../../components/ui'

interface LeaveType {
  id: string; name: string; color: string; days_allowed: number; hours_allowed: number; duration_type: string
}

interface LeaveRequest {
  id: string; staff_id: string; leave_type_id: string; start_date: string; end_date: string;
  hours_requested: number | null; duration_type: string; status: string; reason: string; notes: string;
  leave_type_name: string; leave_type_color: string; leave_duration_type: string;
  first_name: string; last_name: string; email?: string; staff_location_id?: string;
  reviewer_first_name?: string; reviewer_last_name?: string; created_at: string
}

interface LeaveBalance {
  id: string; leave_type_name: string; leave_type_color: string; duration_type: string;
  days_allocated: number; days_taken: number; days_remaining: number;
  hours_allocated: number; hours_taken: number; hours_remaining: number;
  effective_days_allocated: number; effective_hours_allocated: number;
  default_days_allowed: number; default_hours_allowed: number
}

interface Location { id: string; name: string }

const pad2 = (n: number) => String(n).padStart(2, '0')
// Build a YYYY-MM-DD string from a local Date (timezone-safe).
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
// Parse a YYYY-MM-DD string as local midnight (not UTC) so comparisons are stable.
const parseYMD = (s: string) => new Date(`${s}T00:00:00`)
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const requestDays = (r: { start_date: string; end_date: string }) =>
  Math.ceil((parseYMD(r.end_date).getTime() - parseYMD(r.start_date).getTime()) / 86400000) + 1

export default function LeaveManagerPage() {
  const [tab, setTab] = useState(0)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [formData, setFormData] = useState({
    leave_type_id: '', start_date: '', end_date: '', reason: '',
    hours_requested: '', duration_type: 'days'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [calendarStats, setCalendarStats] = useState<any[]>([])
  const [delegationDialog, setDelegationDialog] = useState(false)
  const [delegationData, setDelegationData] = useState({ delegate_manager_id: '', ends_at: '' })
  const [delegationError, setDelegationError] = useState('')
  const [delegationSaving, setDelegationSaving] = useState(false)
  const [delegationDeleting, setDelegationDeleting] = useState('')
  const [delegationLeaveStart, setDelegationLeaveStart] = useState('')
  const [activeDelegations, setActiveDelegations] = useState<any[]>([])
  const [delegates, setDelegates] = useState<any[]>([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [dayPopover, setDayPopover] = useState<{ anchor: HTMLElement; date: string; events: any[]; stats: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [allLoading, setAllLoading] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [myPage, setMyPage] = useState(0)
  const [allPage, setAllPage] = useState(0)
  const [reviewingId, setReviewingId] = useState('')
  const [cancellingId, setCancellingId] = useState('')
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null)
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null)

  let rawUser: any = {}
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) rawUser = JSON.parse(userStr)
  } catch { /* corrupted storage */ }
  const isAdminOrManager = rawUser.role === 'ORG_ADMIN' || rawUser.role === 'MANAGER'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const [typesRes, myReqRes, balRes, locRes] = await Promise.all([
        api.get('/leave/types'),
        api.get('/leave/my-requests'),
        api.get('/leave/balances'),
        api.get('/leave/locations'),
      ])
      setLeaveTypes(typesRes.data)
      setMyRequests(myReqRes.data)
      setBalances(balRes.data)
      setLocations(locRes.data)
    } catch (err: any) {
      setFetchError(err.response?.data?.message || 'Failed to load leave data')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAllRequests = useCallback(async () => {
    setAllLoading(true)
    setFetchError('')
    try {
      const params = new URLSearchParams()
      if (filterLocation) params.append('location_id', filterLocation)
      if (filterStatus) params.append('status', filterStatus)
      const res = await api.get(`/leave/requests?${params.toString()}`)
      setAllRequests(res.data)
    } catch (err: any) {
      setFetchError(err.response?.data?.message || 'Failed to load all requests')
    } finally {
      setAllLoading(false)
    }
  }, [filterLocation, filterStatus])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (isAdminOrManager) fetchAllRequests() }, [fetchAllRequests, isAdminOrManager])

  const fetchActiveDelegations = useCallback(async () => {
    if (!isAdminOrManager || !rawUser.id) return
    try {
      const res = await api.get('/settings/delegations')
      setActiveDelegations(res.data.filter((d: any) => d.is_active && d.primary_manager_id === rawUser.id))
    } catch { console.warn('Failed to fetch delegations') }
  }, [isAdminOrManager, rawUser.id])

  useEffect(() => { fetchActiveDelegations() }, [fetchActiveDelegations])

  useEffect(() => {
    const fetchStats = async () => {
      setCalendarLoading(true)
      try {
        const res = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
        setCalendarStats(res.data)
      } catch { console.warn('Failed to fetch calendar stats') }
      setCalendarLoading(false)
    }
    if (tab === (isAdminOrManager ? 2 : 1)) fetchStats()
  }, [tab, isAdminOrManager, calendarMonth])

  const handleRequestLeave = async () => {
    setError('')
    setSuccess('')
    if (!formData.leave_type_id || !formData.start_date) {
      setError('Please fill in required fields'); return
    }
    const payload: any = {
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      duration_type: formData.duration_type,
    }
    if (formData.duration_type === 'hours') {
      payload.end_date = formData.start_date
      payload.hours_requested = parseFloat(formData.hours_requested)
      if (!payload.hours_requested || payload.hours_requested <= 0) {
        setError('Please enter the number of hours'); return
      }
    } else {
      payload.end_date = formData.end_date || formData.start_date
      payload.reason = formData.reason
    }
    try {
      const res = await api.post('/leave/my-requests', payload)
      setSuccess(res.data?.status === 'approved' ? 'Leave request submitted and auto-approved' : 'Leave request submitted')
      setOpenDialog(false)
      const leaveStartDate = payload.start_date
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '', hours_requested: '', duration_type: 'days' })
      fetchData()
      // Refresh calendar stats
      const statsRes = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
      setCalendarStats(statsRes.data)
      if (isAdminOrManager) {
        const delRes = await api.get('/settings/delegations')
        const activeDelegation = delRes.data.some((d: any) => d.primary_manager_id === rawUser.id && d.is_active)
        if (!activeDelegation) {
          const staffRes = await api.get('/settings/staff')
          setDelegates(staffRes.data.filter((s: any) => (s.role === 'MANAGER' || s.role === 'ORG_ADMIN') && s.id !== rawUser.id))
          setDelegationError('')
          setDelegationData({ delegate_manager_id: '', ends_at: '' })
          setDelegationLeaveStart(leaveStartDate)
          setDelegationDialog(true)
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit request')
    }
  }

  const handleReview = async (id: string, status: string) => {
    setReviewingId(id)
    setError('')
    setSuccess('')
    try {
      await api.patch(`/leave/requests/${id}/review`, { status })
      setDayPopover(null)
      setSuccess(`Leave request ${status} successfully`)
      fetchAllRequests()
      fetchData()
      const statsRes = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
      setCalendarStats(statsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to review leave request')
    } finally {
      setReviewingId('')
    }
  }

  const handleCancel = async (id: string) => {
    setCancellingId(id)
    setError('')
    setSuccess('')
    try {
      await api.patch(`/leave/requests/${id}/cancel`)
      setCancelTarget(null)
      setSuccess('Leave request cancelled')
      fetchData()
      fetchAllRequests()
      const statsRes = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
      setCalendarStats(statsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel leave request')
    } finally {
      setCancellingId('')
    }
  }

  const handleRemoveDelegation = async (id: string) => {
    setDelegationDeleting(id)
    setError('')
    setSuccess('')
    try {
      await api.delete(`/settings/delegations/${id}`)
      setSuccess('Delegation removed')
      setActiveDelegations(prev => prev.filter(d => d.id !== id))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove delegation')
    } finally {
      setDelegationDeleting('')
    }
  }

  const getDelegationMinDate = () => {
    const today = new Date().toISOString().split('T')[0]
    return delegationLeaveStart && delegationLeaveStart > today ? delegationLeaveStart : today
  }

  const selectedType = leaveTypes.find(t => t.id === formData.leave_type_id)
  const relatedBalance = balances.find(b => b.leave_type_name === selectedType?.name)

  const statusChip = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#FEF3C7', text: '#92400E' },
      approved: { bg: '#D1FAE5', text: '#065F46' },
      rejected: { bg: '#FEE2E2', text: '#991B1B' },
      cancelled: { bg: '#E5E7EB', text: '#374151' },
    }
    const c = colors[status] || { bg: '#E5E7EB', text: '#374151' }
    return <Chip label={status} size="small" sx={{ bgcolor: c.bg, color: c.text, fontWeight: 600, textTransform: 'capitalize' }} />
  }

  const formatBalance = (b: LeaveBalance) => {
    if (b.duration_type === 'hours') {
      return `${b.hours_remaining.toFixed(1)}h / ${b.effective_hours_allocated.toFixed(1)}h`
    }
    const dr = Number(b.days_remaining); const eda = Number(b.effective_days_allocated);
    return `${Number.isFinite(dr) ? dr.toFixed(1) : '0.0'}d / ${Number.isFinite(eda) ? eda.toFixed(1) : '0.0'}d`
  }

  const allApprovedRequests = isAdminOrManager
    ? [...new Map([...myRequests, ...allRequests].map(r => [r.id, r])).values()].filter(r => r.status === 'approved')
    : myRequests.filter(r => r.status === 'approved')

  const calendarEvents = allApprovedRequests
    .flatMap(r => {
      const events = []
      const start = parseYMD(r.start_date)
      const end = parseYMD(r.end_date)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const label = r.duration_type === 'hours' && r.hours_requested
          ? `${r.leave_type_name} (${r.hours_requested}h)`
          : r.leave_type_name
        events.push({
          date: new Date(d), label, color: r.leave_type_color, id: r.id,
          staff: `${r.first_name} ${r.last_name}`, type: r.leave_type_name,
          status: r.status, duration_type: r.duration_type, hours_requested: r.hours_requested,
          start_date: r.start_date, end_date: r.end_date, reason: r.reason,
          staff_id: r.staff_id, leave_type_id: r.leave_type_id,
        })
      }
      return events
    })

  const getDayRequests = (date: Date) => {
    const allReqs = isAdminOrManager ? [...myRequests, ...allRequests] : myRequests
    return allReqs.filter(r => {
      const s = parseYMD(r.start_date), e = parseYMD(r.end_date)
      return date >= s && date <= e
    }).map(r => ({
      ...r,
      duration: r.duration_type === 'hours' && r.hours_requested
        ? `${r.hours_requested}h`
        : `${requestDays(r)}d`,
    }))
  }

  const startOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
  const startDay = startOfMonth.getDay()
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
  const calendarDays = Array.from({ length: startDay + daysInMonth }, (_, i) => {
    if (i < startDay) return null
    return new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i - startDay + 1)
  })

  const totalOnLeave = calendarStats.reduce((s, d) => s + d.staff_on_leave, 0)
  const totalApproved = calendarStats.reduce((s, d) => s + d.approved_count, 0)
  const totalPending = calendarStats.reduce((s, d) => s + d.pending_count, 0)

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LeaveIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Leave Manager</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {balances.length > 0 ? (() => {
            const hoursPerDay = 7.5
            const dayBalances = balances.filter(b => b.duration_type === 'days')
            const hourBalances = balances.filter(b => b.duration_type === 'hours')
            const totalDaysAllocated = dayBalances.reduce((s, b) => s + Number(b.effective_days_allocated), 0)
            const totalDaysTaken = dayBalances.reduce((s, b) => s + Number(b.days_taken), 0)
            const totalDaysRemaining = dayBalances.reduce((s, b) => s + Number(b.days_remaining), 0)
            const totalHoursAllocated = hourBalances.reduce((s, b) => s + Number(b.effective_hours_allocated), 0)
            const totalHoursTaken = hourBalances.reduce((s, b) => s + Number(b.hours_taken), 0)
            const totalHoursRemaining = hourBalances.reduce((s, b) => s + Number(b.hours_remaining), 0)
            const pendingDays = myRequests.filter(r => r.status === 'pending' && r.duration_type === 'days')
              .reduce((s, r) => s + Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1, 0)
            const pendingHours = myRequests.filter(r => r.status === 'pending' && r.duration_type === 'hours')
              .reduce((s, r) => s + Number(r.hours_requested || 0), 0)
            const allDaysAllocated = totalDaysAllocated + Math.floor(totalHoursAllocated / hoursPerDay)
            const allDaysTaken = totalDaysTaken + Math.floor(totalHoursTaken / hoursPerDay)
            const allDaysRemaining = totalDaysRemaining + Math.floor(totalHoursRemaining / hoursPerDay)
            const totalPendingDays = pendingDays + Math.floor(pendingHours / hoursPerDay)
            const totalPendingHours = Math.round(pendingHours % hoursPerDay)

            const fmt = (d: number, h: number) => {
              const p: string[] = []
              if (d > 0) p.push(`${d}d`)
              if (h > 0) p.push(`${h}h`)
              return p.join(' ') || '0h'
            }

            return (
              <>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#0F4C81" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Total {fmt(allDaysAllocated, Math.round(totalHoursAllocated % hoursPerDay))}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {totalDaysAllocated.toFixed(0)}d + {totalHoursAllocated.toFixed(0)}h
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#DC2626" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Used {fmt(allDaysTaken, Math.round(totalHoursTaken))}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {totalDaysTaken.toFixed(0)}d + {totalHoursTaken.toFixed(0)}h
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#D97706" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Pending {fmt(totalPendingDays, totalPendingHours)}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {pendingDays}d + {pendingHours}h
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#16A34A" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Left {fmt(allDaysRemaining, Math.round(totalHoursRemaining % hoursPerDay))}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {totalDaysRemaining.toFixed(0)}d + {totalHoursRemaining.toFixed(0)}h
                  </Typography>
                </Box>
              </>
            )
          })() : (
            <Typography variant="body2" color="#9CA3AF">No leave balances configured.</Typography>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}
            sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' }, ml: 1 }}>
            Request Leave
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}

      {isAdminOrManager && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid #DBEAFE', bgcolor: '#F8FAFC' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F4C81', mb: 1 }}>
            Active Delegations
          </Typography>
          {activeDelegations.length > 0 ? (
            <Stack spacing={1}>
              {activeDelegations.map((d: any) => (
                <Stack key={d.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {d.delegate_first_name || 'Delegate'} {d.delegate_last_name || ''}
                    </Typography>
                    <Typography variant="caption" color="#6B7280">
                      {d.ends_at ? `Ends ${new Date(d.ends_at).toLocaleDateString()}` : 'No end date'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={delegationDeleting === d.id ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
                    disabled={delegationDeleting === d.id}
                    onClick={() => handleRemoveDelegation(d.id)}
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="#9CA3AF">No active delegations.</Typography>
          )}
        </Paper>
      )}

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); if (v === 1 && isAdminOrManager) fetchAllRequests() }}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2, '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}>
          <Tab label="My Requests" />
          {isAdminOrManager && <Tab label="All Requests" />}
          <Tab label="Calendar" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (<>
        {tab === 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {myRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No leave requests yet</TableCell></TableRow>
                ) : myRequests.slice(myPage * 10, myPage * 10 + 10).map(r => {
                  const days = requestDays(r)
                  const duration = r.duration_type === 'hours' && r.hours_requested
                    ? `${r.hours_requested}h`
                    : `${days}d`
                  const canCancelFutureApproved = r.status === 'approved' && parseYMD(r.start_date) > new Date()
                  return (
                    <TableRow key={r.id} hover
                      onClick={() => setDetailRequest(r)}
                      sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Chip label={r.leave_type_name} size="small" sx={{ bgcolor: (r.leave_type_color || '#0F4C81') + '20', color: r.leave_type_color || '#0F4C81', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>{fmtDay(parseYMD(r.start_date))}{r.end_date !== r.start_date ? ` - ${fmtDay(parseYMD(r.end_date))}` : ''}</TableCell>
                      <TableCell>{duration}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '-'}</TableCell>
                      <TableCell>{statusChip(r.status)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {r.status === 'pending' && (
                          <Button size="small" color="error" disabled={cancellingId === r.id}
                            onClick={() => handleCancel(r.id)}>
                            {cancellingId === r.id ? <CircularProgress size={14} color="inherit" sx={{ mr: 0.5 }} /> : null}
                            Cancel
                          </Button>
                        )}
                        {canCancelFutureApproved && (
                          <Button size="small" color="error" onClick={() => setCancelTarget(r)}>
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {myRequests.length > 10 && (
              <TablePagination component="div" count={myRequests.length} page={myPage}
                onPageChange={(_e, p) => setMyPage(p)} rowsPerPage={10} rowsPerPageOptions={[10]}
                onRowsPerPageChange={undefined} />
            )}
          </TableContainer>
        )}

        {tab === 1 && isAdminOrManager && (
          <Box>
            {allLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (<>
            <Stack direction="row" spacing={2} sx={{ p: 2, borderBottom: '1px solid #E5E7EB' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Location</InputLabel>
                <Select value={filterLocation} label="Location" onChange={e => setFilterLocation(e.target.value)}>
                  <MenuItem value="">All Locations</MenuItem>
                  {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No leave requests found</TableCell></TableRow>
                  ) : allRequests.slice(allPage * 10, allPage * 10 + 10).map(r => {
                    const days = requestDays(r)
                    const duration = r.duration_type === 'hours' && r.hours_requested
                      ? `${r.hours_requested}h`
                      : `${days}d`
                    return (
                      <TableRow key={r.id} hover
                        onClick={() => setDetailRequest(r)}
                        sx={{ cursor: 'pointer' }}>
                        <TableCell sx={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</TableCell>
                        <TableCell>
                        <Chip label={r.leave_type_name} size="small" sx={{ bgcolor: (r.leave_type_color || '#0F4C81') + '20', color: r.leave_type_color || '#0F4C81', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>{fmtDay(parseYMD(r.start_date))}{r.end_date !== r.start_date ? ` - ${fmtDay(parseYMD(r.end_date))}` : ''}</TableCell>
                        <TableCell>{duration}</TableCell>
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '-'}</TableCell>
                        <TableCell>{statusChip(r.status)}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {r.status === 'pending' && (
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Approve">
                                <IconButton size="small" color="success" disabled={reviewingId === r.id}
                                  onClick={() => handleReview(r.id, 'approved')}>
                                  {reviewingId === r.id ? <CircularProgress size={16} /> : <ApproveIcon />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton size="small" color="error" disabled={reviewingId === r.id}
                                  onClick={() => handleReview(r.id, 'rejected')}>
                                  {reviewingId === r.id ? <CircularProgress size={16} /> : <RejectIcon />}
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {allRequests.length > 10 && (
              <TablePagination component="div" count={allRequests.length} page={allPage}
                onPageChange={(_e, p) => setAllPage(p)} rowsPerPage={10} rowsPerPageOptions={[10]}
                onRowsPerPageChange={undefined} />
            )}
          </>)}
          </Box>
        )}

        {tab === (isAdminOrManager ? 2 : 1) && (
          <Box sx={{ p: 3 }}>
            {calendarLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (<>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton size="small" onClick={() => {
                  const d = new Date(calendarMonth); d.setMonth(d.getMonth() - 1); setCalendarMonth(d)
                }}><ChevronLeft /></IconButton>
                <CalendarIcon sx={{ color: '#0F4C81' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Typography>
                <IconButton size="small" onClick={() => {
                  const d = new Date(calendarMonth); d.setMonth(d.getMonth() + 1); setCalendarMonth(d)
                }}><ChevronRight /></IconButton>
              </Stack>
              {isAdminOrManager && (
                <Stack direction="row" spacing={2}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0F4C81' }}>{totalOnLeave}</Typography>
                    <Typography variant="caption" color="#6B7280">On Leave</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#16A34A' }}>{totalApproved}</Typography>
                    <Typography variant="caption" color="#6B7280">Approved</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#D97706' }}>{totalPending}</Typography>
                    <Typography variant="caption" color="#6B7280">Pending</Typography>
                  </Box>
                </Stack>
              )}
            </Stack>

            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Box key={d} sx={{ width: '14.285%', textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{d}</Typography>
                </Box>
              ))}
              {calendarDays.map((day, i) => {
                if (!day) return <Box key={`empty-${i}`} sx={{ width: '14.285%', minHeight: 90, border: '1px solid #F3F4F6' }} />
                const events = calendarEvents.filter(e => e.date.toDateString() === day.toDateString())
                const isToday = day.toDateString() === new Date().toDateString()
                const stats = calendarStats.find(s => s.date === toYMD(day))
                return (
                  <Box key={i} sx={{
                    width: '14.285%', minHeight: 90, p: 0.5, borderRadius: 0,
                    bgcolor: isToday ? '#E7EEF4' : 'transparent',
                    border: '1px solid #F3F4F6',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#F8FAFC' },
                  }}
                    onClick={(e) => {
                      const dayReqs = getDayRequests(day)
                      if (dayReqs.length > 0 || (stats && (stats.staff_on_leave > 0 || stats.pending_count > 0))) {
                        setDayPopover({ anchor: e.currentTarget, date: toYMD(day), events: dayReqs, stats })
                      }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: isToday ? 800 : 400, color: isToday ? '#0F4C81' : '#6B7280' }}>
                      {day.getDate()}
                    </Typography>
                    {stats && isAdminOrManager && (
                      <Box sx={{ mt: 0.3 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.5rem', display: 'block', color: '#16A34A', fontWeight: 700, lineHeight: 1.2 }}>
                          {stats.staff_on_leave > 0 ? `${stats.staff_on_leave} on leave` : '0 on leave'}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.5rem', display: 'block', color: '#D97706', fontWeight: 600, lineHeight: 1.2 }}>
                          {stats.pending_count > 0 ? `${stats.pending_count} requests` : '0 requests'}
                        </Typography>
                      </Box>
                    )}
                    {events.slice(0, 2).map(e => (
                      <Chip key={e.id} label={e.label} size="small"
                        sx={{ width: '100%', height: 14, fontSize: '0.45rem', mt: 0.1,
                          bgcolor: (e.color || '#0F4C81') + '30', color: e.color || '#0F4C81', fontWeight: 700, '& .MuiChip-label': { px: 0.2 } }} />
                    ))}
                    {events.length > 2 && (
                      <Typography variant="caption" sx={{ fontSize: '0.45rem', color: '#9CA3AF', display: 'block', textAlign: 'center' }}>
                        +{events.length - 2} more
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>
          </>)}
          </Box>
        )}
          </>)}
      </Paper>

      <Popover
        open={Boolean(dayPopover)}
        anchorEl={dayPopover?.anchor}
        onClose={() => setDayPopover(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
        transformOrigin={{ vertical: 'center', horizontal: 'center' }}
        PaperProps={{ sx: { p: 2, minWidth: 320, maxWidth: 400 } }}
      >
        {dayPopover && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              {new Date(dayPopover.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {dayPopover.stats && isAdminOrManager && (
              <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                <Typography variant="caption" color="#16A34A" sx={{ fontWeight: 700 }}>
                  {dayPopover.stats.staff_on_leave} staff on leave
                </Typography>
                <Typography variant="caption" color="#D97706" sx={{ fontWeight: 600 }}>
                  {dayPopover.stats.pending_count} pending
                </Typography>
              </Stack>
            )}
            {dayPopover.events.length > 0 ? (
              <List dense disablePadding>
                {dayPopover.events.map((e: any) => (
                  <ListItem key={e.id} disablePadding sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{e.first_name} {e.last_name}</Typography>
                          <Chip label={e.leave_type_name || e.type} size="small"
                            sx={{ height: 18, fontSize: '0.6rem', bgcolor: (e.leave_type_color || '#0F4C81') + '20', color: e.leave_type_color || '#0F4C81', fontWeight: 700 }} />
                          <Chip label={e.status} size="small"
                            color={e.status === 'approved' ? 'success' : e.status === 'rejected' ? 'error' : e.status === 'pending' ? 'warning' : 'default'}
                            sx={{ height: 18, fontSize: '0.6rem' }} />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.3} sx={{ mt: 0.3 }}>
                          <Typography variant="caption" color="#6B7280">
                            {e.duration} &middot; {new Date(e.start_date).toLocaleDateString()}{e.end_date !== e.start_date ? ` - ${new Date(e.end_date).toLocaleDateString()}` : ''}
                          </Typography>
                          {e.reason && <Typography variant="caption" color="#9CA3AF" sx={{ fontStyle: 'italic' }}>"{e.reason}"</Typography>}
                          {e.status === 'pending' && isAdminOrManager && (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.3 }}>
                              <Button size="small" variant="contained" color="success" sx={{ height: 22, fontSize: '0.6rem', py: 0 }}
                                disabled={reviewingId === e.id}
                                onClick={() => handleReview(e.id, 'approved')}>
                                {reviewingId === e.id ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : 'Approve'}
                              </Button>
                              <Button size="small" variant="contained" color="error" sx={{ height: 22, fontSize: '0.6rem', py: 0 }}
                                disabled={reviewingId === e.id}
                                onClick={() => handleReview(e.id, 'rejected')}>
                                {reviewingId === e.id ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : 'Reject'}
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="#9CA3AF">No leave on this day.</Typography>
            )}
          </Box>
        )}
      </Popover>

      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); setError(''); setSuccess('') }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request Leave</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <TextField select label="Leave Type" value={formData.leave_type_id}
              onChange={e => setFormData(p => ({ ...p, leave_type_id: e.target.value, duration_type: leaveTypes.find(t => t.id === e.target.value)?.duration_type || 'days' }))} fullWidth>
              {leaveTypes.map(t => <MenuItem key={t.id} value={t.id}>
                <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                  <span>{t.name}</span>
                  <Typography variant="caption" color="#6B7280">
                    ({t.duration_type === 'hours' ? `${t.hours_allowed}h` : `${t.days_allowed}d`} allowance)
                  </Typography>
                </Stack>
              </MenuItem>)}
            </TextField>

            {selectedType && relatedBalance && (
              <Alert severity="info" icon={<InfoIcon />} sx={{ py: 1 }}>
                Balance: {formatBalance(relatedBalance)}
                {selectedType.duration_type === 'hours'
                  ? ` (${Number(relatedBalance.hours_remaining).toFixed(1)}h available)`
                  : ` (${Number(relatedBalance.days_remaining).toFixed(1)}d available)`}
              </Alert>
            )}

            <FormControlLabel
              control={<Switch checked={formData.duration_type === 'hours'}
                onChange={e => setFormData(p => ({ ...p, duration_type: e.target.checked ? 'hours' : 'days' }))}
                disabled={selectedType?.duration_type === 'days'} />}
              label="Book in hours (partial day)"
            />

            <TextField label="Date" type="date" value={formData.start_date}
              onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />

            {formData.duration_type === 'hours' ? (
              <TextField label="Hours" type="number" value={formData.hours_requested}
                onChange={e => setFormData(p => ({ ...p, hours_requested: e.target.value }))}
                inputProps={{ min: 0.5, max: 12, step: 0.5 }}
                helperText="Enter hours (e.g., 2 for a 2-hour leave)" fullWidth />
            ) : (
              <TextField label="End Date" type="date" value={formData.end_date}
                onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            )}

            {formData.duration_type === 'days' && (
              <TextField label="Reason" multiline rows={3} value={formData.reason}
                onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))} fullWidth />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRequestLeave}
            sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>Submit Request</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={delegationDialog} onClose={() => setDelegationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Set Up Delegation?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="#6B7280">
              As a manager, you may want to delegate your responsibilities while on leave.
              Optionally select someone to cover for you.
            </Typography>
            {delegationError && <Alert severity="error">{delegationError}</Alert>}
            <FormControl fullWidth size="small">
              <InputLabel>Delegate</InputLabel>
              <Select value={delegationData.delegate_manager_id} label="Delegate"
                onChange={e => setDelegationData(p => ({ ...p, delegate_manager_id: e.target.value }))}>
                <MenuItem value=""><em>Skip (no delegation)</em></MenuItem>
                {delegates.map((d: any) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.primary_first_name || d.first_name} {d.primary_last_name || d.last_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="End Date (optional)" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              inputProps={{ min: getDelegationMinDate() }}
              helperText={delegationLeaveStart ? `Cannot be earlier than ${new Date(delegationLeaveStart).toLocaleDateString()}` : 'Cannot be in the past'}
              value={delegationData.ends_at || ''}
              onChange={e => setDelegationData(p => ({ ...p, ends_at: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button disabled={delegationSaving} onClick={() => setDelegationDialog(false)}>Skip</Button>
          <Button variant="contained" disabled={delegationSaving} onClick={async () => {
            setDelegationError('')
            try {
              if (delegationData.delegate_manager_id) {
                if (delegationData.ends_at && delegationData.ends_at < getDelegationMinDate()) {
                  setDelegationError(delegationLeaveStart
                    ? 'Delegation expiry date cannot be earlier than the leave start date'
                    : 'Delegation expiry date cannot be in the past')
                  return
                }
                setDelegationSaving(true)
                await api.post('/settings/delegations', {
                  primary_manager_id: rawUser.id,
                  delegate_manager_id: delegationData.delegate_manager_id,
                  ends_at: delegationData.ends_at || null,
                  starts_at: delegationLeaveStart || null
                })
              }
              setDelegationDialog(false)
              setDelegationData({ delegate_manager_id: '', ends_at: '' })
              setDelegationLeaveStart('')
              fetchActiveDelegations()
            } catch (err: any) {
              setDelegationError(err.response?.data?.message || 'Failed to set delegation')
            } finally {
              setDelegationSaving(false)
            }
          }} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
            {delegationSaving ? <><CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />Setting...</> : 'Set Delegation'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailRequest)} onClose={() => setDetailRequest(null)} maxWidth="sm" fullWidth>
        {detailRequest && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <span>{detailRequest.first_name} {detailRequest.last_name}</span>
                {statusChip(detailRequest.status)}
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>LEAVE TYPE</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    <Chip label={detailRequest.leave_type_name} size="small"
                      sx={{ bgcolor: (detailRequest.leave_type_color || '#0F4C81') + '20', color: detailRequest.leave_type_color || '#0F4C81', fontWeight: 600 }} />
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>DATES</Typography>
                  <Typography variant="body2">{fmtDay(parseYMD(detailRequest.start_date))}
                    {detailRequest.end_date !== detailRequest.start_date ? ` - ${fmtDay(parseYMD(detailRequest.end_date))}` : ''}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>DURATION</Typography>
                  <Typography variant="body2">
                    {detailRequest.duration_type === 'hours' && detailRequest.hours_requested
                      ? `${detailRequest.hours_requested}h`
                      : `${requestDays(detailRequest)} day(s)`}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>REASON</Typography>
                  <Typography variant="body2">{detailRequest.reason || '-'}</Typography>
                </Box>
                {detailRequest.notes && (
                  <Box>
                    <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>REVIEWER NOTES</Typography>
                    <Typography variant="body2" color="#4B5563">{detailRequest.notes}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>REVIEWER</Typography>
                  <Typography variant="body2">
                    {detailRequest.reviewer_first_name || detailRequest.reviewer_last_name
                      ? `${detailRequest.reviewer_first_name || ''} ${detailRequest.reviewer_last_name || ''}`.trim()
                      : 'Not reviewed yet'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="#6B7280" sx={{ fontWeight: 700 }}>REQUESTED</Typography>
                  <Typography variant="body2">{new Date(detailRequest.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDetailRequest(null)}>Close</Button>
              {detailRequest.status === 'pending' && isAdminOrManager && (
                <Stack direction="row" spacing={1}>
                  <Button color="success" variant="contained" disabled={reviewingId === detailRequest.id}
                    onClick={() => handleReview(detailRequest.id, 'approved')}>
                    Approve
                  </Button>
                  <Button color="error" variant="contained" disabled={reviewingId === detailRequest.id}
                    onClick={() => handleReview(detailRequest.id, 'rejected')}>
                    Reject
                  </Button>
                </Stack>
              )}
              {detailRequest.status === 'pending' && (
                <Button color="error" disabled={cancellingId === detailRequest.id}
                  onClick={() => handleCancel(detailRequest.id)}>Cancel Request</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel leave request?"
        message={`This will withdraw ${cancelTarget?.leave_type_name} leave for ${cancelTarget ? fmtDay(parseYMD(cancelTarget.start_date)) : ''}${cancelTarget && cancelTarget.end_date !== cancelTarget.start_date ? ` - ${fmtDay(parseYMD(cancelTarget.end_date))}` : ''}. Any leave already approved will have its balance reversed.`}
        confirmLabel="Cancel Leave"
        cancelLabel="Keep Request"
        danger
        loading={cancellingId === cancelTarget?.id}
        onConfirm={() => cancelTarget && handleCancel(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />
    </Box>
  )
}
