import { useState, useEffect, useCallback } from 'react'
import {
  Box, Paper, Typography, Button, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Stack, IconButton,
  Alert, FormControl, InputLabel, Select, Tooltip,
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
// Parse a date into local midnight. The API returns DATE columns as ISO
// strings (e.g. "2026-08-15T00:00:00.000Z"), so use the literal YYYY-MM-DD
// part rather than JS Date parsing to avoid off-by-one/Invalid Date issues.
const parseYMD = (s: any): Date => {
  if (!s) return new Date(NaN)
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate())
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const requestDays = (r: { start_date: string; end_date: string }) =>
  Math.ceil((parseYMD(r.end_date).getTime() - parseYMD(r.start_date).getTime()) / 86400000) + 1

// All leave is calculated in hours; this converts an hour count to the
// "X days + Y hours" display used across the balance summary.
const HOURS_PER_DAY = 7.5
const hoursToDaysHours = (totalHours: number) => ({
  days: Math.floor(totalHours / HOURS_PER_DAY),
  hours: Math.round(totalHours % HOURS_PER_DAY),
})
const fmtDaysHours = (totalHours: number) => {
  const { days, hours } = hoursToDaysHours(totalHours)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  return parts.join(' ') || '0h'
}

// The per-day leave allowance derives from the staff member's contracted hours
// (5 working days per week). Falls back to the standard 7.5h for anyone
// without a contracted-hours figure on record.
const dailyCapFor = (staffMembers: any[], staffId: string) => {
  const staff = staffMembers.find((s: any) => s.id === staffId)
  const weekly = staff ? Number(staff.contracted_hours_weekly) : 0
  return weekly > 0 ? Math.round((weekly / 5) * 10) / 10 : HOURS_PER_DAY
}

// Auto-fill hours from the selected date range so staff don't have to work it
// out (days x per-day allowance, rounded to the nearest half hour).
const calcHours = (staffMembers: any[], staffId: string, start: string, end: string) =>
  Math.round(requestDays({ start_date: start, end_date: end }) * dailyCapFor(staffMembers, staffId) * 2) / 2

export default function LeaveManagerPage() {
  const [tab, setTab] = useState(0)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [formData, setFormData] = useState({
    staff_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '',
    hours_requested: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [calendarStats, setCalendarStats] = useState<any[]>([])
  const [uniqueOnLeave, setUniqueOnLeave] = useState(0)
  const [staffMembers, setStaffMembers] = useState<any[]>([])
  const [dayLoading, setDayLoading] = useState(false)
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
      const [typesRes, myReqRes, balRes, locRes, staffRes] = await Promise.all([
        api.get('/leave/types'),
        api.get('/leave/my-requests'),
        api.get('/leave/balances'),
        api.get('/leave/locations'),
        api.get('/settings/staff'),
      ])
      setLeaveTypes(typesRes.data)
      setMyRequests(myReqRes.data)
      setBalances(balRes.data)
      setLocations(locRes.data)
      setStaffMembers(staffRes.data)
    } catch (err: any) {
      setFetchError(err.response?.data?.message || 'Failed to load leave data')
    } finally {
      setLoading(false)
    }
  }, [isAdminOrManager])

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
        setCalendarStats(res.data.dates || [])
        setUniqueOnLeave(res.data.unique_staff_on_leave || 0)
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
    const hoursRequested = parseFloat(formData.hours_requested)
    if (!hoursRequested || hoursRequested <= 0) {
      setError('Please enter the number of hours'); return
    }
    const daysCount = formData.start_date
      ? requestDays({ start_date: formData.start_date, end_date: formData.end_date || formData.start_date })
      : 0
    const cap = dailyCapFor(staffMembers, formData.staff_id)
    if (daysCount > 0 && hoursRequested > daysCount * cap + 0.01) {
      setError(`Cannot request more than ${cap} hours per day (your daily contracted hours)`); return
    }
    const payload: any = {
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      end_date: formData.end_date || formData.start_date,
      duration_type: 'hours',
      hours_requested: hoursRequested,
      reason: formData.reason,
    }
    if (formData.staff_id) payload.staff_id = formData.staff_id
    try {
      const res = await api.post('/leave/my-requests', payload)
      setSuccess(res.data?.status === 'approved' ? 'Leave request submitted and auto-approved' : 'Leave request submitted')
      setOpenDialog(false)
      const leaveStartDate = payload.start_date
      const bookedForRole = payload.staff_id
        ? (staffMembers.find((s: any) => s.id === payload.staff_id)?.role || '')
        : rawUser.role
      setFormData({ staff_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '', hours_requested: '' })
      fetchData()
      // Refresh calendar stats
      const statsRes = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
      setCalendarStats(statsRes.data.dates || [])
      setUniqueOnLeave(statsRes.data.unique_staff_on_leave || 0)
      if (isAdminOrManager) fetchAllRequests()
      // Delegation only matters when a manager's own leave (or another
      // manager's) needs covering — not when booking leave for a care worker.
      if (isAdminOrManager && (bookedForRole === 'MANAGER' || bookedForRole === 'ORG_ADMIN')) {
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
      setDetailRequest(null)
      setSuccess(`Leave request ${status} successfully`)
      fetchAllRequests()
      fetchData()
      const statsRes = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
      setCalendarStats(statsRes.data.dates || [])
      setUniqueOnLeave(statsRes.data.unique_staff_on_leave || 0)
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
      setDetailRequest(null)
      setDayPopover(null)
      setSuccess('Leave request cancelled')
      fetchData()
      fetchAllRequests()
      const statsRes = await api.get(`/leave/calendar-stats?month=${calendarMonth.getMonth() + 1}&year=${calendarMonth.getFullYear()}`)
      setCalendarStats(statsRes.data.dates || [])
      setUniqueOnLeave(statsRes.data.unique_staff_on_leave || 0)
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

  const selectedDays = formData.start_date
    ? requestDays({ start_date: formData.start_date, end_date: formData.end_date || formData.start_date })
    : 0
  const selectedCap = dailyCapFor(staffMembers, formData.staff_id)
  const selectedHours = parseFloat(formData.hours_requested) || 0
  const overDailyCap = selectedDays > 0 && selectedHours > selectedDays * selectedCap + 0.01

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

  const totalOnLeave = uniqueOnLeave
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
            const totalAllocatedHours = balances.reduce((s, b) => s + Number(b.effective_hours_allocated || 0), 0)
            const totalTakenHours = balances.reduce((s, b) => s + Number(b.hours_taken || 0), 0)
            const totalRemainingHours = balances.reduce((s, b) => s + Number(b.hours_remaining || 0), 0)
            const pendingHoursTotal = myRequests
              .filter(r => r.status === 'pending')
              .reduce((s, r) => s + (r.duration_type === 'hours' ? Number(r.hours_requested || 0) : requestDays(r) * HOURS_PER_DAY), 0)

            const fmt = fmtDaysHours

            return (
              <>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#0F4C81" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Total {fmt(totalAllocatedHours)}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {totalAllocatedHours.toFixed(1)}h
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#DC2626" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Used {fmt(totalTakenHours)}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {totalTakenHours.toFixed(1)}h
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#D97706" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Pending {fmt(pendingHoursTotal)}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {pendingHoursTotal.toFixed(1)}h
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <Typography variant="caption" color="#16A34A" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                    Left {fmt(totalRemainingHours)}
                  </Typography>
                  <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {totalRemainingHours.toFixed(1)}h
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

      {!openDialog && error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {!openDialog && success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
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
                    onClick={async (e) => {
                      const dayStats = calendarStats.find(s => s.date === toYMD(day))
                      if (isAdminOrManager) {
                        if (!dayStats || (dayStats.staff_on_leave === 0 && dayStats.pending_count === 0)) return
                        setDayLoading(true)
                        try {
                          // Fetch from the server so the popup always agrees
                          // with the day cell summary (which lists every org
                          // staff member, not just what this browser has loaded).
                          const res = await api.get(`/leave/calendar-day?date=${toYMD(day)}`)
                          setDayPopover({ anchor: e.currentTarget, date: toYMD(day), events: res.data, stats: dayStats })
                        } catch {
                          const dayReqs = getDayRequests(day)
                          setDayPopover({ anchor: e.currentTarget, date: toYMD(day), events: dayReqs, stats: dayStats })
                        } finally {
                          setDayLoading(false)
                        }
                      } else {
                        const dayReqs = getDayRequests(day)
                        if (dayReqs.length === 0) return
                        setDayPopover({ anchor: e.currentTarget, date: toYMD(day), events: dayReqs, stats: dayStats })
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
            {dayLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : dayPopover.events.length > 0 ? (
              <List dense disablePadding>
                {dayPopover.events.map((e: any) => {
                  const duration = e.duration_type === 'hours' && e.hours_requested
                    ? `${e.hours_requested}h`
                    : `${requestDays(e)}d`
                  return (
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
                              {duration} &middot; {fmtDay(parseYMD(e.start_date))}{e.end_date !== e.start_date ? ` - ${fmtDay(parseYMD(e.end_date))}` : ''}
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
                  )
                })}
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
            {isAdminOrManager && (
              <TextField select label="Staff Member" value={formData.staff_id}
                onChange={e => setFormData(p => {
                  const staffId = e.target.value
                  return {
                    ...p,
                    staff_id: staffId,
                    hours_requested: p.start_date ? String(calcHours(staffMembers, staffId, p.start_date, p.end_date || p.start_date)) : p.hours_requested,
                  }
                })} fullWidth
                helperText="Leave as default to book leave for yourself">
                <MenuItem value="">{rawUser.first_name ? `${rawUser.first_name} ${rawUser.last_name || ''} (myself)` : 'Myself'}</MenuItem>
                {staffMembers
                  .filter((s: any) => s.id !== rawUser.id && rawUser.id && s.user_id !== rawUser.id)
                  .map((s: any) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.role === 'ORG_ADMIN' ? 'Admin' : s.role === 'MANAGER' ? 'Manager' : 'Care Worker'})
                    </MenuItem>
                  ))}
              </TextField>
            )}

            <TextField select label="Leave Type" value={formData.leave_type_id}
              onChange={e => setFormData(p => ({ ...p, leave_type_id: e.target.value }))} fullWidth>
              {leaveTypes.map(t => <MenuItem key={t.id} value={t.id}>
                <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                  <span>{t.name}</span>
                  <Typography variant="caption" color="#6B7280">
                    ({t.duration_type === 'hours' ? `${t.hours_allowed}h` : `${(t.days_allowed * HOURS_PER_DAY)}h`} allowance)
                  </Typography>
                </Stack>
              </MenuItem>)}
            </TextField>

            {selectedType && relatedBalance && (
              <Alert severity="info" icon={<InfoIcon />} sx={{ py: 1 }}>
                Balance: {formatBalance(relatedBalance)}
                {` (${Number(relatedBalance.hours_remaining).toFixed(1)}h available)`}
              </Alert>
            )}

            <TextField label="Start Date" type="date" value={formData.start_date}
              onChange={e => setFormData(p => {
                const start = e.target.value
                // If the end date falls before the new start, clear it so the
                // range stays valid, then auto-calculate the hours.
                const end = p.end_date && start && p.end_date >= start ? p.end_date : ''
                return {
                  ...p,
                  start_date: start,
                  end_date: end,
                  hours_requested: start ? String(calcHours(staffMembers, p.staff_id, start, end || start)) : '',
                }
              })}
              InputLabelProps={{ shrink: true }} fullWidth />

            <TextField label="End Date (optional)" type="date" value={formData.end_date}
              onChange={e => setFormData(p => {
                const end = e.target.value
                return {
                  ...p,
                  end_date: end,
                  hours_requested: p.start_date && end ? String(calcHours(staffMembers, p.staff_id, p.start_date, end)) : p.hours_requested,
                }
              })}
              InputLabelProps={{ shrink: true }} fullWidth
              helperText="Leave blank for a single day" />

            <TextField label="Hours" type="number" value={formData.hours_requested}
              onChange={e => setFormData(p => ({ ...p, hours_requested: e.target.value }))}
              inputProps={{ min: 0.5, step: 0.5 }}
              error={overDailyCap}
              helperText={
                overDailyCap
                  ? `Cannot request more than ${selectedCap} hours per day (your daily contracted hours)`
                  : formData.start_date
                    ? `Auto-calculated: ${selectedDays} day${selectedDays !== 1 ? 's' : ''} x ${selectedCap}h = ${calcHours(staffMembers, formData.staff_id, formData.start_date, formData.end_date || formData.start_date)}h. Adjust for half days.`
                    : `Enter hours (e.g., ${selectedCap}h for a full day, ${selectedCap / 2}h for a half day)`
              }
              fullWidth />

            <TextField label="Reason" multiline rows={3} value={formData.reason}
              onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))} fullWidth />
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
